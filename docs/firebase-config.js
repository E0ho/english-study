// Firebase 웹 앱 설정. Firebase 콘솔 → 프로젝트 설정 → 내 앱 → SDK 설정 및 구성 에서 복사해 넣는다.
// 이 값은 비밀이 아니다 (앱을 가리키는 주소일 뿐). 보안은 Firestore 규칙이 담당한다 (README "학습 기록 동기화" 참고).
// null 이면 앱은 동기화 없이 폰 저장소만 쓴다.
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyB-OWjlmPVXkfnAjQBtNNOpsflJBjfeWxw",
  authDomain: "english-study-83fbf.firebaseapp.com",
  projectId: "english-study-83fbf",
  storageBucket: "english-study-83fbf.firebasestorage.app",
  messagingSenderId: "1029494142124",
  appId: "1:1029494142124:web:bd66f361f14d507fa45b09",
};
