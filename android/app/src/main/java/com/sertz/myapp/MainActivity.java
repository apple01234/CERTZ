package com.sertz.myapp;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/* v1.0.5-beta (vc128) — 게임 화면 완전 전체화면(몰입 모드) 적용 — 유저 지시:
 *  삼성 3버튼 내비게이션 바(뒤로가기 < · 홈 ○ · 최근앱 |||)와 상태바를 게임 중 숨김.
 *  · WindowInsetsControllerCompat.hide(systemBars()) — 상태바+내비게이션 바 동시 숨김
 *    (targetSdk 36 엣지투엣지 강제 환경과 minSdk 24 구형 기기 모두 호환 — androidx가 내부 분기)
 *  · BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE — 화면 가장자리 스와이프 시 임시 표시(투명 스크림)
 *    후 자동 재숨김. 홈 복귀·백버튼 사용은 스와이프로 언제든 가능
 *  · onWindowFocusChanged 재숨김 — 구글 로그인 계정 선택창 등 다이얼로그가 포커스를 가져가
 *    시스템 바가 복원된 경우, 창이 닫힌 직후 자동으로 다시 숨김 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
