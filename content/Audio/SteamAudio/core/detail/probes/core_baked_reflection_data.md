---
title: "[Core] BakedReflectionsData 저장과 보간"
author: KurtJang
tags: [Blog, "#Programming", "#CPP", "#SteamAudio"]
date: 2026-11-12
draft: "False"
description: "probe별 EnergyField/Reverb 저장, invalidation, weighted lookup과 FlatBuffers 직렬화"
---
---
# 1. 역할

`BakedReflectionsData`는 identifier 하나에 해당하는 probe별 reflection 결과를 보관한다.
설정에 따라 convolution용 `EnergyField` array, parametric reverb용 `Reverb` array 또는 
둘 다 둘 수 있다. 각 probe entry의 freshness는 `mNeedsUpdate` byte array가 추적한다.

ProbeBatch가 `IBakedData` interface로 모든 layer mutation을 전달하는 흐름은
[[core_probe_batch|ProbeBatch 분석]], runtime neighborhood에서 결과를 섞는 것은 
[[core_baked_reflection_simulator|BakedReflectionSimulator 분석]]을 참고한다.

---

# 2. 자료 구조와 invalidation

생성 시 모든 `mNeedsUpdate[i]`는 true다. bake 결과를 `set(index, value)`로 넣으면 해당 
entry가 false가 된다. probe 이동 시 해당 entry를 dirty하고, 추가 probe는 dirty 상태로 
append, 삭제 probe는 관련 배열에서 같은 index를 지운다. 
`setHasConvolution/Parametric`으로 결과 유형을 새로 켜면 저장 배열을 확장하고 
모든 probe를 dirty로 표시한다.


```mermaid
%%{init: {"theme":"base","themeVariables":{"background":"#111827","darkMode":true,"primaryColor":"#3d6049","primaryTextColor":"#dfe2e6","primaryBorderColor":"#cbd5e1","secondaryColor":"#334f70","secondaryTextColor":"#dfe2e6","secondaryBorderColor":"#cbd5e1","tertiaryColor":"#665b32","tertiaryTextColor":"#dfe2e6","tertiaryBorderColor":"#cbd5e1","clusterBkg":"#743737","clusterBorder":"#cbd5e1","lineColor":"#cbd5e1","textColor":"#dfe2e6","nodeTextColor":"#dfe2e6","actorBkg":"#303943","actorBorder":"#cbd5e1","actorTextColor":"#dfe2e6","actorLineColor":"#cbd5e1","signalColor":"#cbd5e1","signalTextColor":"#dfe2e6","labelBoxBkgColor":"#743737","labelBoxBorderColor":"#cbd5e1","labelTextColor":"#dfe2e6","activationBkgColor":"#334f70","activationBorderColor":"#cbd5e1","noteBkgColor":"#665b32","noteBorderColor":"#cbd5e1","noteTextColor":"#dfe2e6"}}}%%
flowchart LR
    Probe[Probe position/data changed] --> Dirty[mNeedsUpdate = true]
    Dirty --> Bake[ReflectionBaker calculates]
    Bake --> Set[EnergyField or Reverb set]
    Set --> Fresh[mNeedsUpdate = false]
    Fresh --> Serialize[Persist valid payload]
    classDef level1 fill:#3d6049,stroke:#cbd5e1,color:#dfe2e6,stroke-width:1.5px;
    classDef level2 fill:#334f70,stroke:#cbd5e1,color:#dfe2e6,stroke-width:1.5px;
    classDef level3 fill:#665b32,stroke:#cbd5e1,color:#dfe2e6,stroke-width:1.5px;
    classDef level4 fill:#743737,stroke:#cbd5e1,color:#dfe2e6,stroke-width:1.5px;
    class Probe level1;
    class Dirty level2;
    class Bake level3;
    class Set,Fresh,Serialize level4;
```

---
# 3. 실제 코드 분석

## 3.1 Weighted <strong style="color:#b3f594">EnergyField</strong> 누적

``` cpp fold title:BakedReflectionsData weighted EnergyField lookup
auto* probeEnergyField = lookupEnergyField(neighborhood.probeIndices[i]);
if (!probeEnergyField)
    continue;

EnergyField::scaleAccumulate(*probeEnergyField,
    neighborhood.weights[i], energyField);
```

유효 neighborhood slot을 순회하고 probe index에서 field를 얻은 뒤 neighborhood weight로
scale-add한다. `evaluateReverb`도 동일하게 slot을 순회하지만 각 band의 reverb time을
`weight * probeTime`만큼 더한다. 
이 단계는 probe별 결과의 interpolation이고, **binaural/convolution effect**를 
실행하는 단계는 아니다.

## 3.2 Endpoint 변경

Static source/listener baked data에는 identifier의 endpoint influence가 관련된다.
`updateEndpoint`는 identifier가 일치하는지 확인하고, 중심 변경 시 
energy field index들을 dirty하게 표시한다. 
중심이 같으면 probe center가 endpoint sphere에 새로 들어오거나 나갔는지 비교해 
invalidation/삭제를 한다. 실제 코드에서 이 함수가 energy field 배열을 기준으로 도는지,
parametric-only bake에서도 기대한 동작인지 별도로 확인해야 한다.

코드상 probe loop의 bound는 `mEnergyFields.size()`다. 
따라서 `mHasConvolution == false`로 생성된 parametric-only 데이터는 이 배열이 비어 있고
endpoint update loop가 실행되지 않는다.
Reverb-only layer의 endpoint 변경 결과를 기대할 때는 이 조건과 호출 경로를 
함께 확인해야 한다.

## 3.3 직렬화

`baked_reflection_data.fbs` schema는 optional `energy_fields`, `reverbs`,
그리고 `needs_update`를 가진다. serializer는 EnergyField offset vector와 Reverb struct
vector를 만들고 update bytes를 기록한다. 
`serializedSize()`는 현재 존재하는 payload와 update 상태를 기반으로 크기를 추산한다.

---
# 4. C API 연결

api_probes.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_probes.cpp)의 `CProbeBatch::getEnergyField/getReverb`는 identifier와 probe
index를 검사한 뒤 `BakedReflectionsData`에서 해당 데이터를 복사해 public output
handle/array로 반환한다. 
API와 내부 data ownership 경계는 [[../api/core_public_api|Public C API 분석]]에 연결했다.

---
# 5. 독립 C++ 핵심 예제

``` cpp fold title:dirty baked entry를 다시 계산하는 패턴
#include <vector>

struct Entry { float value = 0.0f; bool dirty = true; };

void storeBake(Entry& entry, float result)
{
    entry.value = result;
    entry.dirty = false;
}

float lookup(const Entry& entry)
{
    return entry.dirty ? 0.0f : entry.value;
}
```

이 예제는 캐시 freshness만 설명한다. Core는 두 종류의 reflection result, probe-weighted
interpolation, endpoint variation, serialized payload와 EnergyField accumulation을
관리한다.

# 6. Source file inventory

아래 파일명 옆의 링크를 열면 Steam Audio 공식 저장소에서 원본을 확인할 수 있다.

<strong style="color:#b3f594">baked_reflection_data.fbs</strong>
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/baked_reflection_data.fbs)

<strong style="color:#b3f594">baked_reflection_data.h</strong>
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/baked_reflection_data.h)

<strong style="color:#b3f594">baked_reflection_data.cpp</strong>
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/baked_reflection_data.cpp)

---

