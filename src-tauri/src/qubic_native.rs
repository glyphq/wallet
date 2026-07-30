#![allow(dead_code)]

use num_bigint::BigInt;
use num_traits::{One, ToPrimitive, Zero};
use tiny_keccak::{Hasher, KangarooTwelve};

const SEED_LENGTH: usize = 55;
const IDENTITY_LENGTH: usize = 60;
const HEADER_SIZE: usize = 80;
const SIG_SIZE: usize = 64;
const PK_SIZE: usize = 32;
const MAX_INPUT_SIZE: usize = 1024;

#[derive(Clone, Debug)]
struct Point {
    x: Fq,
    y: Fq,
    z: Fq,
    ta: Fq,
    tb: Fq,
}

#[derive(Clone, Debug)]
struct R2 {
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

type Fq = [BigInt; 2];

fn bi(hex: &str) -> BigInt {
    BigInt::parse_bytes(hex.as_bytes(), 16).expect("valid bigint literal")
}

fn p() -> BigInt { (BigInt::one() << 127usize) - BigInt::one() }
fn order() -> BigInt { bi("0029cbc14e5e0a72f05397829cbc14e5dfbd004dfe0f79992fb2540ec7768ce7") }
fn param_d() -> Fq { [bi("00000000000000e40000000000000142"), bi("5e472f846657e0fcb3821488f1fc0c8d")] }
fn generator_x() -> Fq { [bi("1a3472237c2fb305286592ad7b3833aa"), bi("1e1f553f2878aa9c96869fb360ac77f6")] }
fn generator_y() -> Fq { [bi("0e3fee9ba120785ab924a2462bcbb287"), bi("6e1c4af8630e024249a7c344844c8b5c")] }
fn order_words() -> [BigInt; 4] { [bi("2fb2540ec7768ce7"), bi("dfbd004dfe0f7999"), bi("f05397829cbc14e5"), bi("0029cbc14e5e0a72")] }
fn mask64() -> BigInt { bi("ffffffffffffffff") }

pub fn k12(input: &[u8], output_len: usize) -> Vec<u8> {
    let mut out = vec![0u8; output_len];
    let mut h = KangarooTwelve::new(b"");
    h.update(input);
    h.finalize(&mut out);
    out
}

fn fp_mod(a: BigInt) -> BigInt {
    let p = p();
    let mut res = a % &p;
    let shifted = &res >> 127usize;
    res += &p & shifted;
    res
}
fn fp_add(a: &BigInt, b: &BigInt) -> BigInt { fp_mod(a + b) }
fn fp_sub(a: &BigInt, b: &BigInt) -> BigInt { fp_mod(a - b) }
fn fp_mul(a: &BigInt, b: &BigInt) -> BigInt { fp_mod(a * b) }
fn fp_sqr(a: &BigInt) -> BigInt { fp_mod(a * a) }
fn fp_neg(a: &BigInt) -> BigInt { fp_mod(p() - a) }
fn fp_hlf(a: &BigInt) -> BigInt { let v = fp_mod(a.clone()); let carry = -(&v & BigInt::one()); (v.clone() + (p() & carry)) >> 1usize }
fn fp_cmov(a: &BigInt, b: &BigInt, flag: i32) -> BigInt { if flag & 1 == 1 { b.clone() } else { a.clone() } }
fn fp_sgn(a: &BigInt) -> i32 {
    let v = fp_mod(a.clone());
    if v.is_zero() { return 0; }
    if ((&v >> 126usize) & BigInt::one()).is_one() { -1 } else { 1 }
}
fn fp_two1251(a: &BigInt) -> BigInt {
    let mut t2 = fp_sqr(a); t2 = fp_mul(&t2, a);
    let mut t3 = fp_sqr(&fp_sqr(&t2)); t3 = fp_mul(&t3, &t2);
    let mut t4 = fp_sqr(&fp_sqr(&fp_sqr(&fp_sqr(&t3)))); t4 = fp_mul(&t4, &t3);
    let mut t5 = fp_sqr(&t4); for _ in 0..7 { t5 = fp_sqr(&t5); } t5 = fp_mul(&t5, &t4);
    let mut tt2 = fp_sqr(&t5); for _ in 0..15 { tt2 = fp_sqr(&tt2); } tt2 = fp_mul(&tt2, &t5);
    let mut t1 = fp_sqr(&tt2); for _ in 0..31 { t1 = fp_sqr(&t1); } t1 = fp_mul(&t1, &tt2);
    for _ in 0..32 { t1 = fp_sqr(&t1); } t1 = fp_mul(&tt2, &t1);
    for _ in 0..16 { t1 = fp_sqr(&t1); } t1 = fp_mul(&t1, &t5);
    for _ in 0..8 { t1 = fp_sqr(&t1); } t1 = fp_mul(&t1, &t4);
    for _ in 0..4 { t1 = fp_sqr(&t1); } t1 = fp_mul(&t1, &t3);
    t1 = fp_sqr(&t1); fp_mul(a, &t1)
}
fn fp_inv(a: &BigInt) -> Result<BigInt, String> { if fp_mod(a.clone()).is_zero() { Err("invert: expected non-zero number".into()) } else { let t=fp_two1251(a); Ok(fp_mul(&fp_sqr(&fp_sqr(&t)), a)) } }
fn fp_to_bytes(a: &BigInt) -> [u8;16] { let mut out=[0u8;16]; let mut tmp=fp_mod(a.clone()); for b in &mut out { *b=(&tmp & BigInt::from(0xffu32)).to_u8().unwrap(); tmp >>= 8usize; } out }
fn fp_from_bytes(buf: &[u8]) -> Option<BigInt> { if buf.len()!=16 || (buf[15] >> 7) != 0 { return None; } let mut v=BigInt::zero(); for b in buf.iter().rev() { v=(v<<8usize)+BigInt::from(*b); } Some(fp_mod(v)) }

fn fq_zero() -> Fq { [BigInt::zero(), BigInt::zero()] }
fn fq_one() -> Fq { [BigInt::one(), BigInt::zero()] }
fn fq_is_zero(a: &Fq) -> bool { fp_mod(a[0].clone()).is_zero() && fp_mod(a[1].clone()).is_zero() }
fn fq_add(a:&Fq,b:&Fq)->Fq{[fp_add(&a[0],&b[0]),fp_add(&a[1],&b[1])]}
fn fq_sub(a:&Fq,b:&Fq)->Fq{[fp_sub(&a[0],&b[0]),fp_sub(&a[1],&b[1])]}
fn fq_mul(a:&Fq,b:&Fq)->Fq{let t1=fp_mul(&a[0],&b[0]);let t2=fp_mul(&a[1],&b[1]);let t3=fp_add(&a[0],&a[1]);let t4=fp_add(&b[0],&b[1]);let mut t5=fp_mul(&t3,&t4);t5=fp_sub(&t5,&t1);t5=fp_sub(&t5,&t2);[fp_sub(&t1,&t2),t5]}
fn fq_sqr(a:&Fq)->Fq{let t1=fp_add(&a[0],&a[1]);let t2=fp_sub(&a[0],&a[1]);let t3=fp_add(&a[0],&a[0]);[fp_mul(&t1,&t2),fp_mul(&t3,&a[1])]}
fn fq_neg(a:&Fq)->Fq{[fp_neg(&a[0]),fp_neg(&a[1])]}
fn fq_inv(a:&Fq)->Result<Fq,String>{let t1=fp_sqr(&a[0]);let t2=fp_sqr(&a[1]);let norm=fp_add(&t1,&t2);let inv=fp_inv(&norm)?;Ok([fp_mul(&a[0],&inv),fp_mul(&a[1],&fp_neg(&inv))])}
fn fq_sgn(a:&Fq)->i32{let s0=fp_sgn(&a[0]);let s1=fp_sgn(&a[1]);if s0!=0 {s0}else{s1}}
fn fq_cmov(a:&Fq,b:&Fq,flag:i32)->Fq{[fp_cmov(&a[0],&b[0],flag),fp_cmov(&a[1],&b[1],flag)]}
fn fq_sqrt(u:&Fq,v:&Fq,s:i32)->Fq{let a=fp_add(&fp_mul(&u[0],&v[0]),&fp_mul(&u[1],&v[1]));let b=fp_add(&fp_sqr(&v[0]),&fp_sqr(&v[1]));let g=fp_sub(&fp_mul(&u[1],&v[0]),&fp_mul(&u[0],&v[1]));let mut t0=fp_add(&fp_sqr(&a),&fp_sqr(&g));for _ in 0..125{t0=fp_sqr(&t0);}let mut t=fp_add(&a,&t0);let t_mod=fp_mod(t.clone());let nonzero=if t_mod.is_zero(){0}else{1};t=fp_cmov(&t,&fp_sub(&a,&t0),1-nonzero);t=fp_add(&t,&t);let mut r=fp_mul(&fp_mul(&fp_sqr(&b),&b),&t);r=fp_two1251(&r);let rb=fp_mul(&r,&b);let c1=fp_mul(&rb,&g);let c0=fp_hlf(&fp_mul(&rb,&t));let x02=fp_sqr(&fp_add(&c0,&c0));let check=fp_sub(&fp_mul(&b,&x02),&t);let swap=if fp_mod(check).is_zero(){0}else{1};let mut result=[fp_cmov(&c0,&c1,swap),fp_cmov(&c1,&c0,swap)];let neg_flag=(1 - fq_sgn(&result)*s) >> 1;result=fq_cmov(&result,&fq_neg(&result),neg_flag);result}
fn fq_to_bytes(a:&Fq)->[u8;32]{let mut out=[0u8;32];out[..16].copy_from_slice(&fp_to_bytes(&a[0]));out[16..].copy_from_slice(&fp_to_bytes(&a[1]));out}
fn fq_from_bytes(buf:&[u8])->Option<Fq>{if buf.len()!=32{return None;}Some([fp_from_bytes(&buf[..16])?,fp_from_bytes(&buf[16..])?])}

fn point_identity()->Point{Point{x:fq_zero(),y:fq_one(),z:fq_one(),ta:fq_zero(),tb:fq_zero()}}
fn point_generator()->Point{Point{x:generator_x(),y:generator_y(),z:fq_one(),ta:generator_x(),tb:generator_y()}}
fn point_double(p:&Point)->Point{let a=fq_sqr(&p.x);let b=fq_sqr(&p.y);let c=fq_sqr(&p.z);let c2=fq_add(&c,&c);let d=fq_add(&a,&b);let xpy=fq_sqr(&fq_add(&p.x,&p.y));let e=fq_sub(&xpy,&d);let f=fq_sub(&b,&a);let g=fq_sub(&c2,&f);Point{x:fq_mul(&e,&g),y:fq_mul(&d,&f),z:fq_mul(&f,&g),ta:d,tb:e}}
fn point_add(p:&Point,q:&R2)->Point{let cc=fq_mul(&p.ta,&p.tb);let h=fq_sub(&p.y,&p.x);let bb=fq_add(&p.y,&p.x);let a=fq_mul(&h,&q.sub_yx);let bv=fq_mul(&bb,&q.add_yx);let e=fq_sub(&bv,&a);let hh=fq_add(&bv,&a);let dd=fq_mul(&p.z,&q.z2);let c2=fq_mul(&cc,&q.dt2);let f=fq_sub(&dd,&c2);let g=fq_add(&dd,&c2);Point{x:fq_mul(&e,&f),y:fq_mul(&g,&hh),z:fq_mul(&f,&g),ta:e,tb:hh}}
fn to_r2(p:&Point)->R2{let t=fq_mul(&p.ta,&p.tb);let dt=fq_mul(&t,&param_d());let dt2=fq_add(&dt,&dt);R2{add_yx:fq_add(&p.y,&p.x),sub_yx:fq_sub(&p.y,&p.x),z2:fq_add(&p.z,&p.z),dt2}}
fn r3_cneg(p:&R3,flag:i32)->R3{R3{add_yx:fq_cmov(&p.add_yx,&p.sub_yx,flag),sub_yx:fq_cmov(&p.sub_yx,&p.add_yx,flag),dt2:fq_cmov(&p.dt2,&fq_neg(&p.dt2),flag)}}
fn r2_cmov(a:&R2,b:&R2,flag:i32)->R2{R2{add_yx:fq_cmov(&a.add_yx,&b.add_yx,flag),sub_yx:fq_cmov(&a.sub_yx,&b.sub_yx,flag),dt2:fq_cmov(&a.dt2,&b.dt2,flag),z2:fq_cmov(&a.z2,&b.z2,flag)}}
fn r2_cneg(p:&R2,flag:i32)->R2{let r=r3_cneg(&R3{add_yx:p.add_yx.clone(),sub_yx:p.sub_yx.clone(),dt2:p.dt2.clone()},flag);R2{add_yx:r.add_yx,sub_yx:r.sub_yx,dt2:r.dt2,z2:p.z2.clone()}}
fn to_affine(p:&Point)->Result<Point,String>{let zi=fq_inv(&p.z)?;let x=fq_mul(&p.x,&zi);let y=fq_mul(&p.y,&zi);Ok(Point{x:x.clone(),y:y.clone(),z:fq_one(),ta:x,tb:y})}
fn add64(a:&BigInt,b:&BigInt,carry:&BigInt)->(BigInt,BigInt){let sum=a+b+carry;(sum.clone()&mask64(),sum>>64usize)}
fn sub64(a:&BigInt,b:&BigInt,borrow:&BigInt)->(BigInt,BigInt){let res=a-b-borrow;(res.clone()&mask64(),(res>>64usize)&BigInt::one())}
fn cond_add_order_n(x:&mut [BigInt;5]){let mask=(&x[0]&BigInt::one())-BigInt::one();let mut carry=BigInt::zero();for (i,ow) in order_words().iter().enumerate(){let addend=ow & &mask;let (r,c)=add64(&x[i],&addend,&carry);x[i]=r;carry=c;}let (r,_)=add64(&x[4],&BigInt::zero(),&carry);x[4]=r;}
fn sub_y_div16(x:&mut [BigInt;5],y:i8){let yb=BigInt::from(y);let s=(&yb>>63usize)&mask64();let (r0,b0)=sub64(&x[0],&(&yb&mask64()),&BigInt::zero());let (r1,b1)=sub64(&x[1],&s,&b0);let (r2,b2)=sub64(&x[2],&s,&b1);let (r3,b3)=sub64(&x[3],&s,&b2);let (r4,_)=sub64(&x[4],&s,&b3);let mask=mask64();x[0]=((&r0>>4usize)|(&r1<<60usize))& &mask;x[1]=((&r1>>4usize)|(&r2<<60usize))& &mask;x[2]=((&r2>>4usize)|(&r3<<60usize))& &mask;x[3]=((&r3>>4usize)|(&r4<<60usize))& &mask;x[4]=(r4>>4usize)&mask;}
fn le_u64(bytes:&[u8])->BigInt{let mut v=BigInt::zero();for b in bytes.iter().rev(){v=(v<<8usize)+BigInt::from(*b);}v}
fn recode_scalar(k:&[u8])->[i8;65]{let mut d=[0i8;65];let mut m=[le_u64(&k[0..8]),le_u64(&k[8..16]),le_u64(&k[16..24]),le_u64(&k[24..32]),BigInt::zero()];cond_add_order_n(&mut m);for di in d.iter_mut().take(64){*di=((&m[0]&BigInt::from(0x1fu32))-BigInt::from(16)).to_i8().unwrap();sub_y_div16(&mut m,*di);}d[64]=(((&m[0]&BigInt::from(0xffu32)) ^ BigInt::from(0x80u32))-BigInt::from(0x80u32)).to_i8().unwrap();d}
fn odd_multiples(q:&Point)->Vec<R2>{let p2=point_double(q);let pp2=to_r2(&p2);let mut t=vec![to_r2(q)];let mut r=q.clone();for _ in 1..8{r=point_add(&r,&pp2);t.push(to_r2(&r));}t}
fn scalar_mult(k:&[u8],q:&Point)->Point{let tab=odd_multiples(q);let d=recode_scalar(k);let mut p=point_identity();for i in (0..=64).rev(){for _ in 0..4{p=point_double(&p);}let di=d[i] as i32;let mask=di>>7;let abs_di=(di+mask)^mask;let inx=(abs_di-1)>>1;let sig=(di>>7)&1;let mut s=R2{add_yx:fq_zero(),sub_yx:fq_zero(),dt2:fq_zero(),z2:fq_zero()};for (j,t) in tab.iter().enumerate(){let flag=if inx == j as i32 {1}else{0};s=r2_cmov(&s,t,flag);}s=r2_cneg(&s,sig);p=point_add(&p,&s);}p}
fn scalar_base_mult(s:&[u8])->Point{scalar_mult(s,&point_generator())}
fn point_marshal(p:&Point)->Result<[u8;32],String>{let aff=to_affine(p)?;let mut out=fq_to_bytes(&aff.y);let s=fq_sgn(&aff.x);let b=(1-s)>>1;out[31]|=(b as u8)<<7;Ok(out)}

fn bytes_to_bigint(bytes:&[u8])->BigInt{le_u64(bytes)}
fn bigint_to_bytes(n:&BigInt)->[u8;32]{let mut out=[0u8;32];let mut tmp=n.clone();for b in &mut out{*b=(&tmp&BigInt::from(0xffu32)).to_u8().unwrap_or(0);tmp >>= 8usize;}out}

pub fn derive_keys(seed:&str)->Result<(Vec<u8>, [u8;32]),String>{if seed.len()!=SEED_LENGTH || !seed.bytes().all(|b| b.is_ascii_lowercase()){return Err("Invalid seed: expected 55 lowercase letters".into());}let seed_bytes:Vec<u8>=seed.bytes().map(|b|b-b'a').collect();let subseed=k12(&seed_bytes,32);let private=k12(&subseed,32);let public=point_marshal(&scalar_base_mult(&private))?;Ok((subseed,public))}
pub fn public_key_from_seed(seed:&str)->Result<[u8;32],String>{Ok(derive_keys(seed)?.1)}
fn encode_checksum(public_key:&[u8])->[u8;4]{let checksum_bytes=k12(public_key,3);let mut checksum=(checksum_bytes[0] as u32)|((checksum_bytes[1] as u32)<<8)|((checksum_bytes[2] as u32)<<16);checksum&=0x3ffff;let mut out=[0u8;4];for o in &mut out{*o=(checksum%26) as u8 + b'A';checksum/=26;}out}
pub fn public_key_to_identity(public_key:&[u8])->Result<String,String>{if public_key.len()!=32{return Err("Public keys must be exactly 32 bytes".into());}let mut chars=Vec::with_capacity(IDENTITY_LENGTH);for i in 0..4{let mut frag=le_u64(&public_key[i*8..i*8+8]);for _ in 0..14{let rem=(&frag%BigInt::from(26u32)).to_u8().unwrap();chars.push(rem+b'A');frag/=26;}}chars.extend_from_slice(&encode_checksum(public_key));String::from_utf8(chars).map_err(|_|"identity utf8 error".to_string())}
pub fn derive_identity_from_seed(seed:&str)->Result<String,String>{public_key_to_identity(&public_key_from_seed(seed)?) }
pub fn identity_to_public_key(identity:&str)->Result<[u8;32],String>{if identity.len()!=IDENTITY_LENGTH || !identity.bytes().all(|b|b.is_ascii_uppercase()){return Err(format!("Invalid identity: expected 60 uppercase letters, got {} chars",identity.len()));}let mut public=[0u8;32];for fragment_index in 0..4{let mut fragment=BigInt::zero();for digit_index in (0..14).rev(){let c=identity.as_bytes()[fragment_index*14+digit_index];fragment=fragment*26+BigInt::from(c-b'A');}let mut tmp=fragment;for j in 0..8{public[fragment_index*8+j]=(&tmp&BigInt::from(0xffu32)).to_u8().unwrap();tmp >>= 8usize;}}let expected=encode_checksum(&public);if identity.as_bytes()[56..60]!=expected{return Err("Invalid identity checksum".into());}Ok(public)}
pub fn sign_digest(message_digest:&[u8], seed:&str)->Result<[u8;64],String>{let (subseed,public_key)=derive_keys(seed)?;let sub_seed_hash=k12(&subseed,64);let mut temp=[0u8;64];temp[..32].copy_from_slice(&sub_seed_hash[32..64]);temp[32..].copy_from_slice(message_digest);let temp_hash=k12(&temp,64);let r_scalar_bytes=&temp_hash[..32];let r_value=bytes_to_bigint(r_scalar_bytes)%order();let point_r=scalar_base_mult(r_scalar_bytes);let point_r_encoding=point_marshal(&point_r)?;let mut final_temp=[0u8;96];final_temp[..32].copy_from_slice(&point_r_encoding);final_temp[32..64].copy_from_slice(&public_key);final_temp[64..].copy_from_slice(message_digest);let final_hash=k12(&final_temp,64);let k_value=bytes_to_bigint(&final_hash[..32])%order();let a_value=bytes_to_bigint(&sub_seed_hash[..32])%order();let ord=order();let mut s_value=(r_value - (k_value*a_value % &ord)) % &ord;if s_value < BigInt::zero(){s_value += &ord;}let mut sig=[0u8;64];sig[..32].copy_from_slice(&point_r_encoding);sig[32..].copy_from_slice(&bigint_to_bytes(&s_value));Ok(sig)}

pub fn sign_message(seed:&str,message:&[u8])->Result<(Vec<u8>,Vec<u8>,String),String>{let digest=k12(message,32);let sig=sign_digest(&digest,seed)?;let public=public_key_from_seed(seed)?;let identity=public_key_to_identity(&public)?;Ok((sig.to_vec(),public.to_vec(),identity))}

fn write_i64_le(out:&mut Vec<u8>,v:i64){out.extend_from_slice(&v.to_le_bytes())}
fn write_u32_le(out:&mut Vec<u8>,v:u32){out.extend_from_slice(&v.to_le_bytes())}
fn write_u16_le(out:&mut Vec<u8>,v:u16){out.extend_from_slice(&v.to_le_bytes())}
fn encode_tx_hash(bytes:&[u8])->String{let digest=k12(bytes,32);let mut chars=Vec::with_capacity(60);for i in 0..4{let mut frag=le_u64(&digest[i*8..i*8+8]);for _ in 0..14{let rem=(&frag%BigInt::from(26u32)).to_u8().unwrap();chars.push(rem+b'a');frag/=26;}}let checksum_bytes=k12(&digest,3);let mut checksum=(checksum_bytes[0] as u32)|((checksum_bytes[1] as u32)<<8)|((checksum_bytes[2] as u32)<<16);checksum&=0x3ffff;for _ in 0..4{chars.push((checksum%26) as u8 + b'a');checksum/=26;}String::from_utf8(chars).unwrap()}
pub fn sign_transaction(seed:&str,destination:&str,amount:i64,target_tick:u32,current_tick:Option<u32>,input_type:u16,payload:&[u8])->Result<(String,String),String>{if payload.len()>MAX_INPUT_SIZE{return Err(format!("Payload too large: {} bytes",payload.len()));}if let Some(cur)=current_tick{if target_tick<=cur{return Err("target tick is not in the future".into());}}let source=public_key_from_seed(seed)?;let dest=identity_to_public_key(destination)?;let mut tx=Vec::with_capacity(HEADER_SIZE+payload.len()+SIG_SIZE);tx.extend_from_slice(&source);tx.extend_from_slice(&dest);write_i64_le(&mut tx,amount);write_u32_le(&mut tx,target_tick);write_u16_le(&mut tx,input_type);write_u16_le(&mut tx,payload.len() as u16);tx.extend_from_slice(payload);let digest=k12(&tx,32);let sig=sign_digest(&digest,seed)?;tx.extend_from_slice(&sig);let encoded=base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &tx);let hash=encode_tx_hash(&tx);Ok((encoded,hash))}

#[cfg(test)]
mod tests {
    use super::*;
    const SEED_A: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const IDENTITY_A: &str = "BZBQFLLBNCXEMGLOBHUVFTLUPLVCPQUASSILFABOFFBCADQSSUPNWLZBQEXK";
    const IDENTITY_B: &str = "DJZMUACQMTYFSEJEYLDBWIGELSFCBMBLPCMBBYFXJHLTGWKHTRRJXTDEHTFL";

    #[test]
    fn k12_empty_matches_known() { assert_eq!(hex::encode(k12(b"",32)), "1ac2d450fc3b4205d19da7bfca1b37513c0803577ac7167f06fe2ce1f0ef39e5"); }

    #[test]
    fn derives_upstream_key_and_identity_fixture() {
        assert_eq!(hex::encode(public_key_from_seed(SEED_A).unwrap()), "1f590d03e613bdded38b4c0820ac44615f91af12435980b3ede3c08c315a2544");
        assert_eq!(derive_identity_from_seed(SEED_A).unwrap(), IDENTITY_A);
        assert_eq!(public_key_to_identity(&identity_to_public_key(IDENTITY_B).unwrap()).unwrap(), IDENTITY_B);
    }

    #[test]
    fn signs_upstream_message_fixture_byte_for_byte() {
        let (signature, public_key, identity) = sign_message(SEED_A, b"hello qubic").unwrap();
        assert_eq!(hex::encode(signature), "08314b48ca73edcb07e3b91ad3ada41f6a99de0f9209ac13ba4647e5f0c76d25dab6aa9a078b4576c72ad00d05c5af1aa73df256a5b81e263dcd490eec7d2000");
        assert_eq!(hex::encode(public_key), "1f590d03e613bdded38b4c0820ac44615f91af12435980b3ede3c08c315a2544");
        assert_eq!(identity, IDENTITY_A);
    }

    #[test]
    fn signs_upstream_transfer_fixture_byte_for_byte() {
        let (encoded, hash) = sign_transaction(SEED_A, IDENTITY_B, 123_456_789, 18_500_005, Some(18_500_000), 0, &[]).unwrap();
        assert_eq!(encoded, "H1kNA+YTvd7Ti0wIIKxEYV+RrxJDWYCz7ePAjDFaJUSR9s+QT3zfoVkRgS6NH21MxVAZhz7zIf6BTOuJxN+3jhXNWwcAAAAApUkaAQAAAACZOflcDgKfRp05kvzeeLV2LOzf6N53T4mlK770dO2FSjzZovW7jCs7rdqnXI+Nlb5Jh/FO+kuILUXKS0GAVwkA");
        assert_eq!(hash, "obllacnvrgymjgtpdclwvfqztizgbaxbiydxalaweewvtcfcwequxiiddmdn");
    }

    #[test]
    fn rejects_invalid_inputs() {
        assert!(public_key_from_seed("short").is_err());
        assert!(identity_to_public_key(&"A".repeat(60)).is_err());
        assert!(sign_transaction(SEED_A, IDENTITY_B, 1, 10, Some(10), 0, &[]).is_err());
        assert!(sign_transaction(SEED_A, IDENTITY_B, 1, 11, Some(10), 0, &vec![0; MAX_INPUT_SIZE + 1]).is_err());
    }
}
