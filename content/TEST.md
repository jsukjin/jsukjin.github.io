---
title: Untitled
author: KurtJang
tags:
  - Blog
date: 2026-08-12
draft: "False"
description: "요약"
---

---
# UAkComponent 최적화 논의 정리

대상 파일: `AkComponent.h` / `AkComponent.cpp` (경로: `Engine/Plugins/Mad/Wwise/Wwise/Source/AkAudio`)
범위: `UAkComponent` 자체의 Tick / 스레딩 / 락 구조만. `MadWwiseAudioService_*` 프레임워크(ObsOcc 서비스 등)는 별도 문서.

---

## 1. `FScopeLock` 스코프 축소 (우선순위 최상, 리스크 낮음)

### 문제
`TickComponent`, `UpdateObstructionAndOcclusion` 두 함수 모두 동일한 패턴:

```cpp
CleanListeners();
FScopeLock Lock(&ListenerCriticalSection);
AkObstructionAndOcclusionService::ListenerMap ObsOccListenerMap;
for (auto& Listener : Listeners)
{
    ObsOccListenerMap.Add(Listener->GetAkGameObjectID(), ...);
}
AkObstructionAndOcclusionService::PortalMap ObsOccPortalMap;
AkAudioDevice->GetObsOccServicePortalMap(...);       // Listeners 안 씀
ObstructionService.Tick(ObsOccListenerMap, ...);      // Listeners 안 씀 — 그런데 락이 여기까지 살아있음
```

`ObsOccListenerMap`은 이미 값 복사본이므로, 복사가 끝나면 락을 풀어도 안전함. 그런데 락이 함수 끝(블록 끝)까지 유지되어, `GetObsOccServicePortalMap()`과 `ObstructionService.Tick()`(async trace 발행 + 폴링, 물리 씬 접근 — 결코 가볍지 않음) 구간까지 불필요하게 잠겨있음.

### 수정
```cpp
CleanListeners();
AkObstructionAndOcclusionService::ListenerMap ObsOccListenerMap;
{
    FScopeLock Lock(&ListenerCriticalSection);
    for (auto& Listener : Listeners)
        ObsOccListenerMap.Add(Listener->GetAkGameObjectID(),
            AkObstructionAndOcclusionService::FListenerInfo(Listener->GetPosition(), Listener->GetSpatialAudioRoomID()));
} // 락 여기서 해제

AkObstructionAndOcclusionService::PortalMap ObsOccPortalMap;
if (AkAudioDevice)
    AkAudioDevice->GetObsOccServicePortalMap(GetSpatialAudioRoom(), GetWorld(), ObsOccPortalMap);

ObstructionService.Tick(ObsOccListenerMap, ObsOccPortalMap, ...);
```

`TickComponent`, `UpdateObstructionAndOcclusion` 두 곳 모두 동일하게 적용 필요.

---

## 2. `CleanListeners()` 매 틱 불필요한 힙 할당/재해시 (버그성 비효율, 락 방식과 무관하게 고쳐야 함)

### 현재 코드
```cpp
void UAkComponent::CleanListeners()
{
    FScopeLock Lock(&ListenerCriticalSection);
    auto ListenerArray = Listeners.Array();     // TSet 전체를 TArray로 복사 (힙 할당)
    for(int i = 0; i < ListenerArray.Num();)
    {
        if(ListenerArray[i] == NULL || ListenerArray[i].IsStale())
            ListenerArray.RemoveAt(i);
        else
            i++;
    }
    Listeners.Empty();                          // 통째로 비움
    for(auto Listener : ListenerArray)
        Listeners.Add(Listener);                // 하나씩 재삽입 (재해시)
}
```
`TickComponent`와 `UpdateObstructionAndOcclusion` **둘 다에서 매 틱 호출됨**. stale 항목이 없는 평범한 틱에도 매번 `.Array()` 할당 → `Empty()` → 전체 재삽입.

### 수정 (TSet의 안전한 반복 중 제거 이터레이터 사용)
```cpp
void UAkComponent::CleanListeners()
{
    FScopeLock Lock(&ListenerCriticalSection);
    for (auto It = Listeners.CreateIterator(); It; ++It)
    {
        if (!It->IsValid())
            It.RemoveCurrent();
    }
}
```
할당 없음, 재해시 없음.

---

## 3. 중복 계산/조건 정리

```cpp
// 반복되는 조건을 한 번만 계산해서 재사용
const bool bReverbEnabled = AkAudioDevice && bUseReverbVolumes && AkAudioDevice->GetMaxAuxBus() > 0;

// GetComponentLocation()도 틱당 두 번 호출되던 걸 한 번으로 캐싱
const FVector ComponentLocation = GetComponentLocation();
```
`AkAudioDevice` null 체크가 한 함수 안에서 4번 반복되는 것도 가독성 문제로 정리 가능 (성능 임팩트는 미미).

---

## 4. `ObsOccListenerMap` / `ObsOccPortalMap` 매 틱 할당 제거

로컬 `TMap` 객체 헤더 자체는 스택에 있지만, `.Add()` 호출 시 내부 버킷 저장소는 힙에 할당됨. 멤버 변수로 승격 후 `Reset()`(원소만 비우고 용량 유지)으로 재사용 시 매 프레임 × 컴포넌트 수만큼의 할당/재해시 비용 제거 가능. 부담되면 최소 `Reserve(Listeners.Num())`만이라도.

```cpp
// 헤더에 멤버로 승격
AkObstructionAndOcclusionService::ListenerMap CachedObsOccListenerMap;
AkObstructionAndOcclusionService::PortalMap  CachedObsOccPortalMap;

// Tick에서
CachedObsOccListenerMap.Reset();
CachedObsOccPortalMap.Reset();
```

---

## 5. `FCriticalSection` → `FRWLock` 전환 (조건부, 컴포넌트 인스턴스별 락에 한함)

### 배경
`ListenerCriticalSection`은 **인스턴스별 락**(`FCriticalSection ListenerCriticalSection;`, 멤버 변수). `Listeners`(`TSet<TWeakObjectPtr<UAkComponent>>`)는 read-heavy 패턴:
- **쓰기**: `RegisterGameObject`, `SetListeners`, `CleanListeners`, `OnListenerUnregistered`, `OnDefaultListenerAdded` — 드묾
- **읽기**: `TickComponent`, `UpdateObstructionAndOcclusion`, `SetOutputBusVolume` — 매 프레임

### FRWLock / FReadScopeLock / FWriteScopeLock 사용법
```cpp
// 헤더
mutable FRWLock ListenerLock;   // const 함수에서도 잠글 수 있게 mutable

// 쓰기 지점 (RegisterGameObject, SetListeners, CleanListeners, OnListenerUnregistered 등)
FWriteScopeLock WriteLock(ListenerLock);
Listeners.Add(NewListener);

// 읽기 지점 (TickComponent, UpdateObstructionAndOcclusion)
{
    FReadScopeLock ReadLock(ListenerLock);
    for (auto& Listener : Listeners) { ... }
} // 여기서 해제 (1번 항목의 스코프 축소와 자연스럽게 결합)
```

**Read/Write 규칙**:
| 현재 상태 | Read 시도 | Write 시도 |
|---|---|---|
| 아무도 없음 | 가능 | 가능 |
| 누군가 Read 중 | ✅ 같이 진입 가능 (다수 동시) | ❌ 대기 |
| 누군가 Write 중 | ❌ 대기 | ❌ 대기 (Write는 항상 독점) |

**주의**:
- 이름 없이 `FReadScopeLock(Lock);`처럼 쓰면 그 줄에서 즉시 소멸(언락)됨 — 반드시 변수명 지정.
- 재진입(같은 스레드에서 이미 잡은 락을 또 잡음) 불가 — `FCriticalSection`과 다름.
- Read → Write 승격(upgrade) 불가.
- Writer 기아(starvation) 가능성 있음(플랫폼 구현에 따라 Reader가 계속 들어오면 Writer가 밀릴 수 있음).

### 정직한 단서 (실익 검증 필요)
`ListenerCriticalSection`은 **컴포넌트 인스턴스별** 락이라 "여러 AkComponent가 서로 경합"하는 그림 자체가 원래 안 생김. FRWLock 전환의 실익은 **같은 인스턴스**의 `Listeners`를 **여러 스레드가 동시에 읽는** 상황이 실제로 있어야 발생. → **적용 전에 Unreal Insights 등으로 이 락의 실제 대기시간을 먼저 확인** 권장.

---

## 6. 중앙화된 기본 리스너 스냅샷 (`TSharedPtr` 기반 RCU / Copy-on-Write) — 더 근본적인 개선

### 문제의 실체
`bUseDefaultListeners == true`(기본값, 대다수 컴포넌트)인 경우:
```cpp
// RegisterGameObject() — 등록 시점에 AkAudioDevice 리스너 목록을 "복사"해서 자기 것으로 만듦
if (bUseDefaultListeners)
{
    FScopeLock Lock(&ListenerCriticalSection);
    const auto& DefaultListeners = AkAudioDevice->GetDefaultListeners();
    Listeners.Empty(DefaultListeners.Num());
    for (auto Listener : DefaultListeners)
        Listeners.Add(Listener);
}
```
```cpp
// UnregisterGameObject() — 리스너 하나 사라질 때 씬의 "모든" AkComponent를 순회하며 통보
if (IsListener)
{
    for (TObjectIterator<UAkComponent> Emitter; Emitter; ++Emitter)
        Emitter->OnListenerUnregistered(this);   // 각자 자기 TSet에서 Remove
}
```
→ 씬에 있는 절대다수 컴포넌트가 **동일한 내용(기본 리스너 집합)**을 각자 따로 들고 있다가, 리스너 하나 바뀔 때마다 **O(N) 순회 + N번의 개별 락/갱신**이 발생. 전형적인 "N개가 같은 데이터의 복사본을 들고 각자 갱신받는" 낭비 패턴.

### 해결: AkAudioDevice에 스냅샷 중앙화 + 포인터 원자적 스왑
```cpp
// FAkAudioDevice.h
using FListenerSnapshot = TArray<FListenerInfo>;

TSharedPtr<const FListenerSnapshot, ESPMode::ThreadSafe> DefaultListenerSnapshot;
FCriticalSection SnapshotWriteLock; // Writer끼리만 순서 보장 (드물게 발생)

// 읽기: 락 없음. TSharedPtr(ThreadSafe) 대입 자체가 원자적 참조카운트 증가
TSharedPtr<const FListenerSnapshot, ESPMode::ThreadSafe> GetDefaultListenerSnapshot() const
{
    return DefaultListenerSnapshot;
}

// 쓰기: 리스너 등록/해제 시에만, 드물게 호출. 배열 통째로 교체
void RebuildDefaultListenerSnapshot()
{
    FScopeLock Lock(&SnapshotWriteLock);
    auto NewSnapshot = MakeShared<const FListenerSnapshot, ESPMode::ThreadSafe>(BuildFromRawListeners());
    DefaultListenerSnapshot = NewSnapshot;
}
```
```cpp
// UAkComponent::TickComponent 등에서, bUseDefaultListeners == true인 경우
auto Snapshot = AkAudioDevice->GetDefaultListenerSnapshot(); // 락 없음
if (Snapshot)
    for (const auto& ListenerInfo : *Snapshot) { ... }
```

왜 안전한가: `TSharedPtr<T, ESPMode::ThreadSafe>`의 대입 연산자는 참조 카운트를 원자적으로 증감. 읽는 순간의 스냅샷을 "붙잡아"두는 구조라, Writer가 그 직후 교체해도 Reader가 들고 있던 이전 스냅샷은 참조 카운트가 0이 될 때까지 살아있음 → 락 없이 데이터 레이스 없음.

### 트레이드오프
- **이득**: Reader(매 프레임 × 컴포넌트 수)는 락 완전히 0. `UnregisterGameObject()`의 O(N) `TObjectIterator` 순회 자체가 사라짐(스냅샷 재구축 1회로 대체).
- **손해**: Writer(리스너 등록/해제 시) 배열 통째로 복사 — 다만 리스너 수가 보통 1~2개라 미미함.
- **하이브리드 필요**: `SetListeners()`로 개별 리스너를 명시 지정한 소수 컴포넌트는 이 중앙 스냅샷과 무관 — 기존 인스턴스별 락(5번 항목) 유지.

### FRWLock vs TSharedPtr 스냅샷 — 언제 뭘 쓰나
| | FRWLock | TSharedPtr 스냅샷(RCU) |
|---|---|---|
| Reader 블로킹 | Writer 진행 중이면 블로킹 | 전혀 블로킹 안 됨 |
| Writer 비용 | 낮음 (제자리 수정) | 높음 (컨테이너 통째로 재생성) |
| 데이터 최신성 | 항상 최신 | 한 프레임 정도 stale 가능 |
| 적합 시나리오 | Reader 수 적당, 즉시성 중요 (예: 컴포넌트별 개별 락) | Reader가 아주 많고(수백~수천) Writer는 극히 드묾 (예: 전역 공유 리스너 목록) |

**결론**: "컴포넌트 인스턴스별 락" 문제는 FRWLock(또는 유지), "모든 컴포넌트가 공유하는 중앙 리스너 목록" 문제는 TSharedPtr 스냅샷. 즉 하이브리드가 정답.

---

## 7. 참고 개념: `EAsyncTraceType` (Test / Single / Multi)

obs/occ 계산에 쓰이는 async line trace 옵션:

| 타입 | 반환 정보 | Overlap 컴포넌트 | 비용 |
|---|---|---|---|
| **Test** | Yes/No만 | 무시 | 가장 저렴 |
| **Single** | 가장 가까운 Block 히트 1개의 상세 정보 | 무시 (Block만 멈춤) | 중간 |
| **Multi** | 지나간 모든 Overlap + 마지막 Block까지 전부, 거리순 정렬 | 기록함 | 가장 비쌈 |

Obstruction/occlusion 계산은 "막혔나 안 막혔나"의 비율만 필요하므로 **`Test`가 정답**(스톡 `AkObstructionAndOcclusionService`, `IsIndoor` 서비스 모두 `Test` 사용). 디버그 시각화(정확히 뭐에 맞았는지)가 필요하면 `Single`로 전환 고려, 단 비용 증가.

---

## 8. 참고: 데이터 레이스 탐지기 (Access Detector)

UE의 `ensureMsgf` 기반 런타임 계측 코드 (예: `TRWAccessDetector` 계열). 실제 락이 아니라 "누가 언제 어느 스레드에서 접근했는지"를 추적하다가 위반 시 콜스택과 함께 경고. Shipping 빌드에서는 제거됨. 락 스코프 축소나 FRWLock/RCU 전환처럼 동시성 구조를 바꿀 때, 새로 만드는 자료구조에 개발 빌드용 안전망으로 같이 넣는 것을 권장 — "락을 없앴는데 실제로 두 스레드가 동시에 쓰기 시도한다" 같은 회귀를 즉시 잡아냄.

---

## 적용 우선순위 요약

1. **락 스코프 축소** (1번) — 리스크 없음, 즉시 적용 권장
2. **`CleanListeners()` 할당 제거** (2번) — 리스크 없음, 즉시 적용 권장
3. **중복 계산 정리 / 맵 재사용** (3, 4번) — 리스크 없음
4. **FRWLock 전환** (5번) — 프로파일링으로 경합 확인 후 결정
5. **중앙 리스너 스냅샷(RCU)** (6번) — 구조 변경 규모 있음, `bUseDefaultListeners` 비율 확인 후 진행. 가장 근본적인 개선이지만 설계/검증 비용 가장 큼












---

<font color="#b3f594">1. 역할 분리</font>
<font color="#b3f594">1. 역할 분리</font>
<font color="#b3f594">1. 역할 분리</font>
<font color="#b3f594">1. 역할 분리</font>


들여쓰기

<details>
  <summary>여기를 클릭해서 내용을 확인하세요 (제목)</summary>
  <div markdown="1">
    
    이곳에 펼쳐질 내용을 작성합니다.
    - 리스트도 가능하고
    - **굵은 글씨**도 가능합니다.

  </div>
</details>


%% 옵시디언에서만 보이는 주석 %%


<font color="#2ecc71">초록색 텍스트</font>
<font color="#3498db">파란색 텍스트</font>
<font color="#ff4d4d">빨간색 텍스트</font>
<font color="#ffa500">주황색 텍스트</font>
<font color="#f1c40f">노란색 텍스트</font>

<font color="#b3f594">■ 이미지의 그 초록색 (연두)</font>
<font color="#80dfff">■ 시원한 밝은 파란색</font>
<font color="#ff6b6b">■ 예쁜 다홍빛 빨간색</font>
<font color="#ffb15b">■ 질문하신 주황색</font>
<font color="#ffff80">■ 눈 안 아픈 부드러운 노란색</font>

<strong style="color:#b3f594">연두색 (이미지 속 그 색상)</strong>
<strong style="color:#80dfff">밝은 하늘색 (정보/참고)</strong>
<strong style="color:#ff6b6b">다홍색 (주의/경고)</strong>
<strong style="color:#ffb15b">주황색 (핵심 키워드)</strong>
<strong style="color:#ffff80">부드러운 노란색 (강조)</strong>

# Code Example
``` cpp fold title:Cmd
au.3dVisualize.Listeners 1
```

``` cpp fold title:subject
int a = 1;
int b = 2;
a + b 3;
```


# Callout Example
> [!info] info
> Contents

> [!todo] todo
> Contents

> [!error] Title
> Contents

> [!question] Title
> Contents

> [!example] Title
> Contents

> [!tip] 팁 (보통 민트/연초록)
> 내용을 입력하세요.

> [!success] 성공 (보통 초록/민트)
> 완료된 항목이나 긍정적인 내용을 넣기 좋습니다.

> [!check] 체크 (success와 비슷함)
> 확인이 필요한 내용에 사용하세요.