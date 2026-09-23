import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SERTZ 개인정보처리방침",
  description: "SERTZ(이그드라실: 아홉 왕국)의 개인정보 수집·이용·삭제 안내",
};

/**
 * v1.4.3 (#데이터보안) — Play Console 데이터 보안 섹션 제출용 개인정보처리방침.
 *  실제 수집 범위(accounts/index.js 구현 기준)에 맞춰 작성:
 *  · 계정: 아이디/닉네임/scrypt 해시 비밀번호/SNS 연동 식별자
 *  · 클라우드 세이브: 게임 세이브 덤프
 *  · 랭킹/거래소: 닉네임·전투력·거래 기록
 *  · 감사 로그: 가입/로그인/거래 추적 (IP 포함)
 *  · 전송: 전 구간 HTTPS (클라에서 http 강제 승격)
 *  · 삭제: /support 페이지의 기기 데이터 삭제 + 계정 삭제 API
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-[radial-gradient(1200px_600px_at_50%_-100px,#1f2a4d_0%,#0a0e18_55%)] px-4 pb-16 pt-10 sm:px-6">
      <header className="text-center">
        <p className="mb-2 text-[11px] font-black tracking-[0.35em] text-sky-300/80">PRIVACY POLICY</p>
        <h1 className="bg-gradient-to-b from-[#ffe49a] via-[#f0b64a] to-[#c8871f] bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
          개인정보처리방침
        </h1>
        <p className="mt-3 text-[12px] text-sky-200/70">시행일: 2026-09-23 · 최종 개정: v1.4.5</p>
      </header>

      <div className="mt-8 flex flex-col gap-6 text-[13px] leading-relaxed text-slate-300">
        <section>
          <h2 className="mb-1.5 text-base font-black text-sky-100">1. 수집하는 항목</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>계정 (선택 — 로그인 시에만)</b>: 아이디, 닉네임, 비밀번호(솔트 해시 — 원문 저장 없음), SNS 로그인 연동 시 각 플랫폼의 고유 식별자</li>
            <li><b>클라우드 세이브 (선택)</b>: 게임 진행 상태(레벨·골드·인벤토리 등) — 로그인 유저의 백업/복원 목적</li>
            <li><b>랭킹·거래소 (선택)</b>: 닉네임, 전투력, 등록/거래 기록</li>
            <li><b>문의 (선택)</b>: 지원센터 폼에 입력한 닉네임·이메일·문의 내용</li>
            <li><b>보안 기록</b>: 가입/로그인/거래·삭제 추적을 위한 감사 로그(IP 포함) — 부정 행위 방지 목적</li>
            <li><b>광고 식별자</b>: 수집·사용하지 않습니다 (AD_ID 권한 미사용 선언)</li>
          </ul>
          <p className="mt-1.5 text-slate-400">
            계정을 만들지 않고도 게임을 즐길 수 있습니다 — 이 경우 모든 진행 데이터는 <b>기기에만</b> 저장되고 서버로 전송되지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-black text-sky-100">2. 수집·이용 목적</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>회원가입·로그인·클라우드 세이브 백업/복원 서비스 제공</li>
            <li>멀티플레이(파티·채팅·친구), 랭킹, 유저 거래소 운영</li>
            <li>문의 접수 및 답변, 부정 행위·남용 방지</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-black text-sky-100">3. 보관 기간 및 파기</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>계정·세이브: 회원 탈퇴(계정 삭제) 시 <b>즉시 파기</b></li>
            <li>감사 로그: 삭제 요청 후 최대 90일 내 자동 파기 (보안 목적 최소 보관)</li>
            <li>문의 기록: 답변 완료 후 최대 90일 내 파기</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-black text-sky-100">4. 전송 암호화</h2>
          <p>
            서버로 전송되는 <b>모든</b> 데이터는 HTTPS(TLS)로 암호화됩니다. 앱은 평문(http) 주소 입력을 자동으로 https로
            승격하며, 비밀번호는 scrypt 솔트 해시로 저장되어 원문이 어디에도 남지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-black text-sky-100">5. 제3자 제공</h2>
          <p>
            수집한 개인정보를 외부에 판매·제공하지 않습니다. SNS 로그인 사용 시 해당 플랫폼(구글/카카오/네이버)과
            인증 정보를 교환하며, 그 범위는 각 플랫폼의 정책을 따릅니다.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-black text-sky-100">6. 삭제 방법 (계정·데이터)</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>기기 데이터</b>: <Link href="/support" className="text-amber-300 underline underline-offset-2">지원센터</Link>의 &quot;기기 데이터 즉시 삭제&quot; 버튼</li>
            <li><b>계정(회원) 데이터</b>: 지원센터의 &quot;계정 삭제&quot; 버튼 (로그인 후 실행 — 즉시 파기)</li>
            <li>직접 처리가 어려우면 지원센터 문의함으로 &quot;데이터 삭제 요청&quot;을 보내 주세요</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-black text-sky-100">7. 문의</h2>
          <p>
            개인정보 관련 문의는 <Link href="/support" className="text-amber-300 underline underline-offset-2">SERTZ 모험자 지원센터</Link>의
            문의함을 이용해 주세요.
          </p>
        </section>
      </div>

      <footer className="mt-10 text-center">
        <Link href="/support" className="rounded-lg border border-amber-300/40 bg-amber-400/10 px-3 py-1.5 text-[12px] font-black text-amber-200 hover:bg-amber-400/20">
          지원센터로 돌아가기
        </Link>
      </footer>
    </main>
  );
}
