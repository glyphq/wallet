//! SchnorrQ curve arithmetic: extended points, scalar recoding and marshal.

use num_bigint::BigInt;
use num_traits::{ToPrimitive, Zero};

use super::field::{
    cond_add_order_n, fq_add, fq_cmov, fq_inv, fq_mul, fq_neg, fq_one, fq_sgn, fq_sqr, fq_sub,
    fq_to_bytes, fq_zero, generator_x, generator_y, le_u64, param_d, sub_y_div16, Fq,
};

#[derive(Clone, Debug)]
pub(super) struct Point {
    x: Fq,
    y: Fq,
    z: Fq,
    ta: Fq,
    tb: Fq,
}

#[derive(Clone, Debug)]
pub(super) struct R2 {
    add_yx: Fq,
    sub_yx: Fq,
    dt2: Fq,
    z2: Fq,
}

#[derive(Clone, Debug)]
struct R3 {
    add_yx: Fq,
    sub_yx: Fq,
    dt2: Fq,
}

pub(super) fn point_identity() -> Point {
    Point {
        x: fq_zero(),
        y: fq_one(),
        z: fq_one(),
        ta: fq_zero(),
        tb: fq_zero(),
    }
}
pub(super) fn point_generator() -> Point {
    Point {
        x: generator_x(),
        y: generator_y(),
        z: fq_one(),
        ta: generator_x(),
        tb: generator_y(),
    }
}
fn point_double(p: &Point) -> Point {
    let a = fq_sqr(&p.x);
    let b = fq_sqr(&p.y);
    let c = fq_sqr(&p.z);
    let c2 = fq_add(&c, &c);
    let d = fq_add(&a, &b);
    let xpy = fq_sqr(&fq_add(&p.x, &p.y));
    let e = fq_sub(&xpy, &d);
    let f = fq_sub(&b, &a);
    let g = fq_sub(&c2, &f);
    Point {
        x: fq_mul(&e, &g),
        y: fq_mul(&d, &f),
        z: fq_mul(&f, &g),
        ta: d,
        tb: e,
    }
}
fn point_add(p: &Point, q: &R2) -> Point {
    let cc = fq_mul(&p.ta, &p.tb);
    let h = fq_sub(&p.y, &p.x);
    let bb = fq_add(&p.y, &p.x);
    let a = fq_mul(&h, &q.sub_yx);
    let bv = fq_mul(&bb, &q.add_yx);
    let e = fq_sub(&bv, &a);
    let hh = fq_add(&bv, &a);
    let dd = fq_mul(&p.z, &q.z2);
    let c2 = fq_mul(&cc, &q.dt2);
    let f = fq_sub(&dd, &c2);
    let g = fq_add(&dd, &c2);
    Point {
        x: fq_mul(&e, &f),
        y: fq_mul(&g, &hh),
        z: fq_mul(&f, &g),
        ta: e,
        tb: hh,
    }
}
fn to_r2(p: &Point) -> R2 {
    let t = fq_mul(&p.ta, &p.tb);
    let dt = fq_mul(&t, &param_d());
    let dt2 = fq_add(&dt, &dt);
    R2 {
        add_yx: fq_add(&p.y, &p.x),
        sub_yx: fq_sub(&p.y, &p.x),
        z2: fq_add(&p.z, &p.z),
        dt2,
    }
}
fn r3_cneg(p: &R3, flag: i32) -> R3 {
    R3 {
        add_yx: fq_cmov(&p.add_yx, &p.sub_yx, flag),
        sub_yx: fq_cmov(&p.sub_yx, &p.add_yx, flag),
        dt2: fq_cmov(&p.dt2, &fq_neg(&p.dt2), flag),
    }
}
fn r2_cmov(a: &R2, b: &R2, flag: i32) -> R2 {
    R2 {
        add_yx: fq_cmov(&a.add_yx, &b.add_yx, flag),
        sub_yx: fq_cmov(&a.sub_yx, &b.sub_yx, flag),
        dt2: fq_cmov(&a.dt2, &b.dt2, flag),
        z2: fq_cmov(&a.z2, &b.z2, flag),
    }
}
fn r2_cneg(p: &R2, flag: i32) -> R2 {
    let r = r3_cneg(
        &R3 {
            add_yx: p.add_yx.clone(),
            sub_yx: p.sub_yx.clone(),
            dt2: p.dt2.clone(),
        },
        flag,
    );
    R2 {
        add_yx: r.add_yx,
        sub_yx: r.sub_yx,
        dt2: r.dt2,
        z2: p.z2.clone(),
    }
}
fn to_affine(p: &Point) -> Result<Point, String> {
    let zi = fq_inv(&p.z)?;
    let x = fq_mul(&p.x, &zi);
    let y = fq_mul(&p.y, &zi);
    Ok(Point {
        x: x.clone(),
        y: y.clone(),
        z: fq_one(),
        ta: x,
        tb: y,
    })
}
fn recode_scalar(k: &[u8]) -> [i8; 65] {
    let mut d = [0i8; 65];
    let mut m = [
        le_u64(&k[0..8]),
        le_u64(&k[8..16]),
        le_u64(&k[16..24]),
        le_u64(&k[24..32]),
        BigInt::zero(),
    ];
    cond_add_order_n(&mut m);
    for di in d.iter_mut().take(64) {
        *di = ((&m[0] & BigInt::from(0x1fu32)) - BigInt::from(16))
            .to_i8()
            .unwrap();
        sub_y_div16(&mut m, *di);
    }
    d[64] = (((&m[0] & BigInt::from(0xffu32)) ^ BigInt::from(0x80u32)) - BigInt::from(0x80u32))
        .to_i8()
        .unwrap();
    d
}
fn odd_multiples(q: &Point) -> Vec<R2> {
    let p2 = point_double(q);
    let pp2 = to_r2(&p2);
    let mut t = vec![to_r2(q)];
    let mut r = q.clone();
    for _ in 1..8 {
        r = point_add(&r, &pp2);
        t.push(to_r2(&r));
    }
    t
}
fn scalar_mult(k: &[u8], q: &Point) -> Point {
    let tab = odd_multiples(q);
    let d = recode_scalar(k);
    let mut p = point_identity();
    for i in (0..=64).rev() {
        for _ in 0..4 {
            p = point_double(&p);
        }
        let di = d[i] as i32;
        let mask = di >> 7;
        let abs_di = (di + mask) ^ mask;
        let inx = (abs_di - 1) >> 1;
        let sig = (di >> 7) & 1;
        let mut s = R2 {
            add_yx: fq_zero(),
            sub_yx: fq_zero(),
            dt2: fq_zero(),
            z2: fq_zero(),
        };
        for (j, t) in tab.iter().enumerate() {
            let flag = if inx == j as i32 { 1 } else { 0 };
            s = r2_cmov(&s, t, flag);
        }
        s = r2_cneg(&s, sig);
        p = point_add(&p, &s);
    }
    p
}
pub(super) fn scalar_base_mult(s: &[u8]) -> Point {
    scalar_mult(s, &point_generator())
}
pub(super) fn point_marshal(p: &Point) -> Result<[u8; 32], String> {
    let aff = to_affine(p)?;
    let mut out = fq_to_bytes(&aff.y);
    let s = fq_sgn(&aff.x);
    let b = (1 - s) >> 1;
    out[31] |= (b as u8) << 7;
    Ok(out)
}
