//! Native deep link state: queues of validated requests/payments and the maps
//! backing replay protection and signing authorizations.

use std::collections::{HashMap, VecDeque};
use std::sync::{atomic::AtomicU64, Arc, Mutex};

use super::authorization::SigningAuthorization;
use super::MAX_PENDING_LINKS;

pub struct DeepLinkState {
    pub(super) pending_requests: Arc<Mutex<VecDeque<String>>>,
    pub(super) pending_payments: Arc<Mutex<VecDeque<String>>>,
    /// Recently completed, native-validated envelopes that may still deliver
    /// their callback. This preserves retry support without exposing a generic
    /// outbound HTTP primitive to the renderer.
    pub(super) callback_delivery_payloads: Arc<Mutex<VecDeque<String>>>,
    /// Maps v2 replay key → unix timestamp of first receipt for time-bounded replay protection.
    pub(super) seen_nonces: Arc<Mutex<HashMap<String, u64>>>,
    pub(super) accepted_requests: Arc<Mutex<HashMap<String, u64>>>,
    pub(super) signing_authorizations: Arc<Mutex<HashMap<String, SigningAuthorization>>>,
    pub(super) authorization_counter: AtomicU64,
}

impl Default for DeepLinkState {
    fn default() -> Self {
        Self {
            pending_requests: Arc::new(Mutex::new(VecDeque::new())),
            pending_payments: Arc::new(Mutex::new(VecDeque::new())),
            callback_delivery_payloads: Arc::new(Mutex::new(VecDeque::new())),
            seen_nonces: Arc::new(Mutex::new(HashMap::new())),
            accepted_requests: Arc::new(Mutex::new(HashMap::new())),
            signing_authorizations: Arc::new(Mutex::new(HashMap::new())),
            authorization_counter: AtomicU64::new(0),
        }
    }
}

impl DeepLinkState {
    /// Queue an already validated request once. Never evict an older request:
    /// preserving its FIFO position is safer than replacing a request that is
    /// already awaiting explicit user review.
    pub fn store(&self, payload: String) -> bool {
        let mut queue = self
            .pending_requests
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        if queue.contains(&payload) || queue.len() >= MAX_PENDING_LINKS {
            return false;
        }
        queue.push_back(payload);
        true
    }

    pub fn peek(&self) -> Option<String> {
        self.pending_requests
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .front()
            .cloned()
    }

    /// Remove only the expected queue head. A stale renderer event must never
    /// consume the request that arrived after it.
    pub fn take_if_front(&self, payload: &str) -> bool {
        let mut queue = self
            .pending_requests
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        if queue.front().is_some_and(|front| front == payload) {
            let completed_payload = queue.pop_front().expect("queue front was present");
            drop(queue);
            Self::store_bounded(&self.callback_delivery_payloads, completed_payload);
            true
        } else {
            false
        }
    }

    /// Only the active request or a recently completed request can submit its
    /// callback. The URL itself is always re-read from the native-validated
    /// envelope, so renderer input cannot select a new destination.
    pub fn authorizes_callback_delivery(&self, payload: &str) -> bool {
        if self
            .pending_requests
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .front()
            .is_some_and(|front| front == payload)
        {
            return true;
        }
        self.callback_delivery_payloads
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .iter()
            .any(|completed| completed == payload)
    }

    pub fn store_payment(&self, payload: String) {
        Self::store_bounded(&self.pending_payments, payload);
    }

    pub fn take_payment(&self) -> Option<String> {
        self.pending_payments
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .pop_front()
    }

    fn store_bounded(queue: &Mutex<VecDeque<String>>, payload: String) {
        let mut queue = queue.lock().unwrap_or_else(|e| e.into_inner());
        if queue.len() == MAX_PENDING_LINKS {
            queue.pop_front();
        }
        queue.push_back(payload);
    }
}
