# Yacht AI 시뮬레이션

학습형 Value Network를 적용하기 전에 현재 heuristic·Expectimax 정책의 기준 성능을 같은
조건에서 측정한다. 시뮬레이터는 운영 WebSocket이나 Redis를 사용하지 않고 운영 점수 계산기와
정책 클래스만 재사용한다.

## 실행

Windows PowerShell에서 `backend`로 이동한 뒤 실행한다.

```powershell
.\gradlew.bat runYachtSimulation --args="--policy heuristic --games 10000 --split test --seed-offset 0"
.\gradlew.bat runYachtSimulation --args="--policy expectimax --games 10000 --split test --seed-offset 0"
```

기본값은 `--policy heuristic --games 100 --split test --seed-offset 0`이다. 지원 정책은
`heuristic`, `expectimax`이고 split은 `train`, `validation`, `test`다.

## 재현성과 데이터 분리

각 게임은 split별 seed 영역과 `seed-offset`으로 결정된다. 같은 정책·split·게임 수·offset을
사용하면 점수와 카테고리 통계가 동일하다. 실행 시간과 정책 결정 시간은 시스템 상태에 따라
달라질 수 있다.

- `train`: 학습 데이터 생성 전용
- `validation`: 모델과 하이퍼파라미터 선택 전용
- `test`: 최종 성능 보고 전용

최종 결과를 확인한 뒤 test 결과에 맞춰 모델을 다시 튜닝하면 안 된다. 추가 튜닝이 필요하면
validation 결과만 사용하고, 새 test offset으로 최종 평가한다.

## 출력 지표

표준 출력에 JSON 보고서가 생성된다.

- 평균·중앙값·표준편차
- 상단 보너스 달성률
- 한 게임에서 0점을 기록한 평균 카테고리 수
- 카테고리별 평균 점수와 0점 기록률
- 평균 정책 결정 시간
- 완료·실패 게임 수와 전체 실행 시간

Value Network 도입 후 동일한 test seed 구간에서 Expectimax와 학습 정책을 비교한다. 평균
점수뿐 아니라 상단 보너스, 희귀 족보, 0점 희생과 추론 지연을 함께 보고한다.
