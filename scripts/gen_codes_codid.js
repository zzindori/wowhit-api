#!/usr/bin/env node
// CODI:D 크레딧 코드 생성기 (20크레딧 고정)
//
// 사용법: CODID_CODE_SECRET=시크릿 node scripts/gen_codes_codid.js [개수] [시작번호]
// 예)   CODID_CODE_SECRET=abc123 node scripts/gen_codes_codid.js 50 1
//
// 생성된 코드를 네이버 스마트스토어
// [디지털/쿠폰 > 자동발송 코드 목록]에 등록하세요.
// 구매 시 자동으로 1개씩 발송됩니다.

import crypto from 'crypto';

const secret = process.env.CODID_CODE_SECRET;
if (!secret) {
  console.error('오류: CODID_CODE_SECRET 환경변수를 설정하세요');
  console.error('예) CODID_CODE_SECRET=your_secret node scripts/gen_codes_codid.js 50');
  process.exit(1);
}

const count = parseInt(process.argv[2]) || 10;
const start = parseInt(process.argv[3]) || 1;

console.log(`# CODI:D 크레딧 코드 (20크레딧)`);
console.log(`# 생성일: ${new Date().toISOString().split('T')[0]}`);
console.log(`# ${count}개 (${start}~${start + count - 1}번)`);
console.log('');

for (let i = start; i < start + count; i++) {
  const serial = String(i).padStart(4, '0');
  const checksum = crypto
    .createHmac('sha256', secret)
    .update(`CODID:${serial}`)
    .digest('hex')
    .slice(0, 6)
    .toUpperCase();
  console.log(`CODID-${serial}-${checksum}`);
}
