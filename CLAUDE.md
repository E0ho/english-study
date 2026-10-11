# 영어 공부 프로젝트

유튜브로 영어를 공부하고, 배운 내용을 `notes/`에 마크다운으로 정리한 뒤
`docs/`의 모바일 복습 앱(GitHub Pages)으로 출퇴근 시간에 복습하는 프로젝트.

## 구조
- `notes/YYYY-MM-DD-제목.md` — 공부 원본. 영상/세션 하나당 파일 하나.
- `scripts/build.js` — notes → `docs/data.json` 변환. `npm run build`
- `docs/` — 바닐라 HTML/JS 복습 앱. GitHub Pages가 이 폴더를 배포.
- `npm run publish` — build + commit + push (배포)

## 사용자가 공부한 내용을 말하면 할 일
1. `notes/` 에 아래 템플릿으로 파일을 만든다. 같은 날 같은 영상이면 기존 파일에 섹션을 추가한다.
2. 내용을 **단어 / 문법 / 패턴 / 표현** 카테고리로 분류한다.
   - 단어: 개별 어휘, 구동사
   - 문법: 시제·관사·전치사 같은 규칙
   - 패턴: `It's been a while since ~` 처럼 빈칸을 채워 쓰는 문장 틀
   - 표현: 관용구, 구어체 한 덩어리 표현
3. 뜻·예문이 빠져 있으면 자연스러운 예문을 보충한다. 예문은 영어 원문 그대로, 뜻은 짧은 한국어로.
4. 파일 작성 후 반드시 `npm run build` 를 실행해 `docs/data.json` 을 갱신한다.
5. 사용자가 "올려줘", "배포해줘" 라고 하면 `npm run publish` 를 실행한다.

## 노트 템플릿
```markdown
---
title: 영상 제목
source: https://youtube.com/watch?v=...
date: 2026-10-11
tags: [일상회화]
---

## 단어
### look forward to
- 뜻: ~을 고대하다
- 예문: I'm looking forward to seeing you.
- 메모: to 뒤에 동명사가 온다

## 패턴
### It's been a while since ~
- 뜻: ~한 지 오래됐다
- 예문: It's been a while since we talked.
```

규칙:
- `## ` = 카테고리, `### ` = 카드 앞면, `- 뜻:` `- 예문:` `- 메모:` = 뒷면 필드
- 예문이 여러 개면 `- 예문:` 줄을 여러 번 써도 되고, 한 줄에 ` / ` 로 구분해도 된다.
- 카드 앞면(`###`)은 카드 id의 재료이므로, 오타 수정 외에는 바꾸지 않는다. 바꾸면 그 카드의 학습 진행이 초기화된다.
