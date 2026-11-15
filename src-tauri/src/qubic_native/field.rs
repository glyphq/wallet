//! Prime-field and quadratic-extension arithmetic backing SchnorrQ.
//!
//! All values are held as `BigInt`s and reduced modulo `p = 2^127 - 1`.  The
//! quadratic extension `Fq = Fp[i] / (i^2 + 1)` is represented as `[re, im]`.

use num_bigint::BigInt;
use num_traits::{One, ToPrimitive, Zero};

pub(super) type Fq = [BigInt; 2];

pub(super) fn bi(hex: &str) -> BigInt {
    BigInt::parse_bytes(hex.as_bytes(), 16).expect("valid bigint literal")
}

pub(super) fn p() -> BigInt {
    (BigInt::one() << 127usize) - BigInt::one()
}
pub(super) fn order() -> BigInt {
    bi("0029cbc14e5e0a72f05397829cbc14e5dfbd004dfe0f79992fb2540ec7768ce7")
}
pub(super) fn param_d() -> Fq {
    [
        bi("00000000000000e40000000000000142"),
        bi("5e472f846657e0fcb3821488f1fc0c8d"),
    ]
}
pub(super) fn generator_x() -> Fq {
    [
        bi("1a3472237c2fb305286592ad7b3833aa"),
        bi("1e1f553f2878aa9c96869fb360ac77f6"),
    ]
}
pub(super) fn generator_y() -> Fq {
    [
        bi("0e3fee9ba120785ab924a2462bcbb287"),
        bi("6e1c4af8630e024249a7c344844c8b5c"),
    ]
}
pub(super) fn order_words() -> [BigInt; 4] {
    [
        bi("2fb2540ec7768ce7"),
        bi("dfbd004dfe0f7999"),
        bi("f05397829cbc14e5"),
        bi("0029cbc14e5e0a72"),
    ]
}
pub(super) fn mask64() -> BigInt {
    bi("ffffffffffffffff")
}

pub(super) fn fp_mod(a: BigInt) -> BigInt {
    let p = p();
    let mut res = a % &p;
    let shifted = &res >> 127usize;
    res += &p & shifted;
    res
}
pub(super) fn fp_add(a: &BigInt, b: &BigInt) -> BigInt {
    fp_mod(a + b)
}
pub(super) fn fp_sub(a: &BigInt, b: &BigInt) -> BigInt {
    fp_mod(a - b)
}
pub(super) fn fp_mul(a: &BigInt, b: &BigInt) -> BigInt {
    fp_mod(a * b)
}
pub(super) fn fp_sqr(a: &BigInt) -> BigInt {
    fp_mod(a * a)
}
pub(super) fn fp_neg(a: &BigInt) -> BigInt {
    fp_mod(p() - a)
}
pub(super) fn fp_hlf(a: &BigInt) -> BigInt {
    let v = fp_mod(a.clone());
    let carry = -(&v & BigInt::one());
    (v.clone() + (p() & carry)) >> 1usize
}
pub(super) fn fp_cmov(a: &BigInt, b: &BigInt, flag: i32) -> BigInt {
    if flag & 1 == 1 {
        b.clone()
    } else {
        a.clone()
    }
}
pub(super) fn fp_sgn(a: &BigInt) -> i32 {
    let v = fp_mod(a.clone());
    if v.is_zero() {
        return 0;
    }
    if ((&v >> 126usize) & BigInt::one()).is_one() {
        -1
    } else {
        1
    }
}
pub(super) fn fp_two1251(a: &BigInt) -> BigInt {
    let mut t2 = fp_sqr(a);
    t2 = fp_mul(&t2, a);
    let mut t3 = fp_sqr(&fp_sqr(&t2));
    t3 = fp_mul(&t3, &t2);
    let mut t4 = fp_sqr(&fp_sqr(&fp_sqr(&fp_sqr(&t3))));
    t4 = fp_mul(&t4, &t3);
    let mut t5 = fp_sqr(&t4);
    for _ in 0..7 {
        t5 = fp_sqr(&t5);
    }
    t5 = fp_mul(&t5, &t4);
    let mut tt2 = fp_sqr(&t5);
    for _ in 0..15 {
        tt2 = fp_sqr(&tt2);
    }
    tt2 = fp_mul(&tt2, &t5);
    let mut t1 = fp_sqr(&tt2);
    for _ in 0..31 {
        t1 = fp_sqr(&t1);
    }
    t1 = fp_mul(&t1, &tt2);
    for _ in 0..32 {
        t1 = fp_sqr(&t1);
    }
    t1 = fp_mul(&tt2, &t1);
    for _ in 0..16 {
        t1 = fp_sqr(&t1);
    }
    t1 = fp_mul(&t1, &t5);
    for _ in 0..8 {
        t1 = fp_sqr(&t1);
    }
    t1 = fp_mul(&t1, &t4);
    for _ in 0..4 {
        t1 = fp_sqr(&t1);
    }
    t1 = fp_mul(&t1, &t3);
    t1 = fp_sqr(&t1);
    fp_mul(a, &t1)
}
pub(super) fn fp_inv(a: &BigInt) -> Result<BigInt, String> {
    if fp_mod(a.clone()).is_zero() {
        Err("invert: expected non-zero number".into())
    } else {
        let t = fp_two1251(a);
        Ok(fp_mul(&fp_sqr(&fp_sqr(&t)), a))
    }
}
pub(super) fn fp_to_bytes(a: &BigInt) -> [u8; 16] {
    let mut out = [0u8; 16];
    let mut tmp = fp_mod(a.clone());
    for b in &mut out {
        *b = (&tmp & BigInt::from(0xffu32)).to_u8().unwrap();
        tmp >>= 8usize;
    }
    out
}
pub(super) fn fp_from_bytes(buf: &[u8]) -> Option<BigInt> {
    if buf.len() != 16 || (buf[15] >> 7) != 0 {
        return None;
    }
    let mut v = BigInt::zero();
    for b in buf.iter().rev() {
        v = (v << 8usize) + BigInt::from(*b);
    }
    Some(fp_mod(v))
}

pub(super) fn fq_zero() -> Fq {
    [BigInt::zero(), BigInt::zero()]
}
pub(super) fn fq_one() -> Fq {
    [BigInt::one(), BigInt::zero()]
}
pub(super) fn fq_is_zero(a: &Fq) -> bool {
    fp_mod(a[0].clone()).is_zero() && fp_mod(a[1].clone()).is_zero()
}
pub(super) fn fq_add(a: &Fq, b: &Fq) -> Fq {
    [fp_add(&a[0], &b[0]), fp_add(&a[1], &b[1])]
}
pub(super) fn fq_sub(a: &Fq, b: &Fq) -> Fq {
    [fp_sub(&a[0], &b[0]), fp_sub(&a[1], &b[1])]
}
pub(super) fn fq_mul(a: &Fq, b: &Fq) -> Fq {
    let t1 = fp_mul(&a[0], &b[0]);
    let t2 = fp_mul(&a[1], &b[1]);
    let t3 = fp_add(&a[0], &a[1]);
    let t4 = fp_add(&b[0], &b[1]);
    let mut t5 = fp_mul(&t3, &t4);
    t5 = fp_sub(&t5, &t1);
    t5 = fp_sub(&t5, &t2);
    [fp_sub(&t1, &t2), t5]
}
pub(super) fn fq_sqr(a: &Fq) -> Fq {
    let t1 = fp_add(&a[0], &a[1]);
    let t2 = fp_sub(&a[0], &a[1]);
    let t3 = fp_add(&a[0], &a[0]);
    [fp_mul(&t1, &t2), fp_mul(&t3, &a[1])]
}
pub(super) fn fq_neg(a: &Fq) -> Fq {
    [fp_neg(&a[0]), fp_neg(&a[1])]
}
pub(super) fn fq_inv(a: &Fq) -> Result<Fq, String> {
    let t1 = fp_sqr(&a[0]);
    let t2 = fp_sqr(&a[1]);
    let norm = fp_add(&t1, &t2);
    let inv = fp_inv(&norm)?;
    Ok([fp_mul(&a[0], &inv), fp_mul(&a[1], &fp_neg(&inv))])
}
pub(super) fn fq_sgn(a: &Fq) -> i32 {
    let s0 = fp_sgn(&a[0]);
    let s1 = fp_sgn(&a[1]);
    if s0 != 0 {
        s0
    } else {
        s1
    }
}
pub(super) fn fq_cmov(a: &Fq, b: &Fq, flag: i32) -> Fq {
    [fp_cmov(&a[0], &b[0], flag), fp_cmov(&a[1], &b[1], flag)]
}
pub(super) fn fq_sqrt(u: &Fq, v: &Fq, s: i32) -> Fq {
    let a = fp_add(&fp_mul(&u[0], &v[0]), &fp_mul(&u[1], &v[1]));
    let b = fp_add(&fp_sqr(&v[0]), &fp_sqr(&v[1]));
    let g = fp_sub(&fp_mul(&u[1], &v[0]), &fp_mul(&u[0], &v[1]));
    let mut t0 = fp_add(&fp_sqr(&a), &fp_sqr(&g));
    for _ in 0..125 {
        t0 = fp_sqr(&t0);
    }
    let mut t = fp_add(&a, &t0);
    let t_mod = fp_mod(t.clone());
    let nonzero = if t_mod.is_zero() { 0 } else { 1 };
    t = fp_cmov(&t, &fp_sub(&a, &t0), 1 - nonzero);
    t = fp_add(&t, &t);
    let mut r = fp_mul(&fp_mul(&fp_sqr(&b), &b), &t);
    r = fp_two1251(&r);
    let rb = fp_mul(&r, &b);
    let c1 = fp_mul(&rb, &g);
    let c0 = fp_hlf(&fp_mul(&rb, &t));
    let x02 = fp_sqr(&fp_add(&c0, &c0));
    let check = fp_sub(&fp_mul(&b, &x02), &t);
    let swap = if fp_mod(check).is_zero() { 0 } else { 1 };
    let mut result = [fp_cmov(&c0, &c1, swap), fp_cmov(&c1, &c0, swap)];
    let neg_flag = (1 - fq_sgn(&result) * s) >> 1;
    result = fq_cmov(&result, &fq_neg(&result), neg_flag);
    result
}
pub(super) fn fq_to_bytes(a: &Fq) -> [u8; 32] {
    let mut out = [0u8; 32];
    out[..16].copy_from_slice(&fp_to_bytes(&a[0]));
    out[16..].copy_from_slice(&fp_to_bytes(&a[1]));
    out
}
pub(super) fn fq_from_bytes(buf: &[u8]) -> Option<Fq> {
    if buf.len() != 32 {
        return None;
    }
    Some([fp_from_bytes(&buf[..16])?, fp_from_bytes(&buf[16..])?])
}

pub(super) fn add64(a: &BigInt, b: &BigInt, carry: &BigInt) -> (BigInt, BigInt) {
    let sum = a + b + carry;
    (sum.clone() & mask64(), sum >> 64usize)
}
pub(super) fn sub64(a: &BigInt, b: &BigInt, borrow: &BigInt) -> (BigInt, BigInt) {
    let res = a - b - borrow;
    (res.clone() & mask64(), (res >> 64usize) & BigInt::one())
}
pub(super) fn cond_add_order_n(x: &mut [BigInt; 5]) {
    let mask = (&x[0] & BigInt::one()) - BigInt::one();
    let mut carry = BigInt::zero();
    for (i, ow) in order_words().iter().enumerate() {
        let addend = ow & &mask;
        let (r, c) = add64(&x[i], &addend, &carry);
        x[i] = r;
        carry = c;
    }
    let (r, _) = add64(&x[4], &BigInt::zero(), &carry);
    x[4] = r;
}
pub(super) fn sub_y_div16(x: &mut [BigInt; 5], y: i8) {
    let yb = BigInt::from(y);
    let s = (&yb >> 63usize) & mask64();
    let (r0, b0) = sub64(&x[0], &(&yb & mask64()), &BigInt::zero());
    let (r1, b1) = sub64(&x[1], &s, &b0);
    let (r2, b2) = sub64(&x[2], &s, &b1);
    let (r3, b3) = sub64(&x[3], &s, &b2);
    let (r4, _) = sub64(&x[4], &s, &b3);
    let mask = mask64();
    x[0] = ((&r0 >> 4usize) | (&r1 << 60usize)) & &mask;
    x[1] = ((&r1 >> 4usize) | (&r2 << 60usize)) & &mask;
    x[2] = ((&r2 >> 4usize) | (&r3 << 60usize)) & &mask;
    x[3] = ((&r3 >> 4usize) | (&r4 << 60usize)) & &mask;
    x[4] = (r4 >> 4usize) & mask;
}
pub(super) fn le_u64(bytes: &[u8]) -> BigInt {
    let mut v = BigInt::zero();
    for b in bytes.iter().rev() {
        v = (v << 8usize) + BigInt::from(*b);
    }
    v
}

pub(super) fn bytes_to_bigint(bytes: &[u8]) -> BigInt {
    le_u64(bytes)
}
pub(super) fn bigint_to_bytes(n: &BigInt) -> [u8; 32] {
    let mut out = [0u8; 32];
    let mut tmp = n.clone();
    for b in &mut out {
        *b = (&tmp & BigInt::from(0xffu32)).to_u8().unwrap_or(0);
        tmp >>= 8usize;
    }
    out
}
