# 영어 공부

유튜브로 배운 단어·문법·패턴을 정리하고, 폰으로 출퇴근길에 복습하는 시스템.

## 흐름
1. Claude에게 공부한 내용을 말하면 `notes/` 에 마크다운으로 정리됨
2. `npm run build` → `docs/data.json` 생성
3. `npm run publish` → GitHub에 푸시, 1분쯤 뒤 Pages 갱신
4. 폰에서 Pages URL 열기 (홈 화면에 추가해 두면 앱처럼 열림, 오프라인도 동작)

## 로컬에서 앱 확인
```bash
npm run build && npm run serve
```
그 다음 http://localhost:8080 접속.

## 노트 형식
`CLAUDE.md` 참고.
