---
title: "[Core] ProbeManager와 ProbeNeighborhood"
author: KurtJang
tags: [Blog, "#Programming", "#CPP", "#SteamAudio"]
date: 2026-11-12
draft: "False"
description: "여러 ProbeBatch lookup, neighborhood occlusion filtering과 normalized weight 계산"
---
---
# 1. 역할

`ProbeManager`는 committed `ProbeBatch` 목록을 보관하고,  query point에서 각 batch의 
후보를 한 `ProbeNeighborhood`에 모은다. 
`ProbeBatch`가 개별 probe와 baked data를 소유한다면 Manager는 여러 batch의 결과를 
query 대상으로 엮는다.

---
# 2. Manager의 두 목록과 commit

헤더는 `mProbeBatches[2]`를 둔다. 
`addProbeBatch`/`removeProbeBatch`는 index 1 목록을 바꾸고, 
`commit()`은 목록 1을 목록 0으로 복사한다. 
query와 `probeBatches()` getter는 index 0을 읽는다. 
즉 편집한 목록을 simulation query에  반영하려면 commit해야 한다.

``` cpp fold title:ProbeManager add/remove와 commit
void ProbeManager::addProbeBatch(shared_ptr<ProbeBatch> probeBatch)
{
    mProbeBatches[1].push_back(probeBatch);
}

void ProbeManager::removeProbeBatch(shared_ptr<ProbeBatch> probeBatch)
{
    mProbeBatches[1].remove(probeBatch);
}

void ProbeManager::commit()
{
    mProbeBatches[0] = mProbeBatches[1];
}
```


---
# 3. Neighborhood lookup와 filtering

Neighborhood 크기는 batch 개수 × batch별 최대 probe 8개다. 
각 batch가 자신의 tree query 결과를 지정한 offset에 기록한다. 
slot에는 batch pointer와 probe index가 같이 있어 같은 index의 baked data를 
올바른 batch에서 찾을 수 있다.

`ProbeNeighborhood::checkOcclusion`은 각 유효 probe center까지의 ray를 만들고
`scene.anyHits`에 batch query로 전달한다. 가려진 slot은 batch를 null, probe index를 -1로 
지워 후속 가중 합에서 제외한다.

``` cpp fold title:occlusion query 준비와 막힌 probe 제거
Vector3f dir = (*batches[i])[probeIndices[i]].influence.center - point;
rays[j] = { point, Vector3f::unitVector(dir) };
minDistances[j] = 0.0f;
maxDistances[j] = dir.length();
rayMapping[j] = i;
++j;

scene.anyHits(nValidProbes, rays.data(), minDistances.data(),
             maxDistances.data(), isOccluded.data());
```

`rayMapping`은 압축된 ray 결과 index를 원래 neighborhood slot로 되돌린다. 
이 매핑 없이 valid probe만 모아 ray query하면 결과를 원래 batch/probe slot에 적용할 수 없다.

---
# 4. 가중치 계산

``` cpp fold title:inverse-distance neighborhood weight와 정규화
weights[i] = 1.0f / ((point - probePosition).length() + 1e-4f);
totalWeight += weights[i];
// valid slot만 아래에서 totalWeight로 나눈다.
weights[i] /= totalWeight;
```

현재 가중치는 거리가 가까울수록 커지는 inverse-distance 형태다. 
주석에도 추후 exponential weighting을 평가할 수 있다고 적혀 있다. 
Probe 영향 sphere 안에서의 weight 계산이며, baked reflection interpolation 자체는
[[core_baked_reflection_data|BakedReflectionsData]]의 energy/<strong style="color:#b3f594">reverb</strong> 누적에서 사용된다.

`findNearest`는 유효 slot 중 최소 squared distance의 slot index를 반환하고,
유효 probe가 없으면 기본값 0을 반환한다. 
호출자는 `hasValidProbes()` 등을 먼저 확인해야 한다.

---
# 5. 독립 C++ 핵심 예제

``` cpp fold title:거리 역수 기반 가중치 정규화
#include <vector>
#include <cmath>

void normalizeInverseDistance(const std::vector<float>& distances,
                              std::vector<float>& weights)
{
    float total = 0.0f;
    for (std::size_t i = 0; i < distances.size(); ++i)
    {
        weights[i] = 1.0f / (distances[i] + 1e-4f);
        total += weights[i];
    }
    if (total > 0.0f)
        for (float& weight : weights)
            weight /= total;
}
```

이 예제는 가중치 수식만 보여준다. 
실제 Core는 batch identity, -1 sentinel, geometry occlusion, Scene vector query, 
여러 baked layer lookup을 함께 관리한다.

---
# 6. 소스 파일

probe_manager.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/probe_manager.h) / probe_manager.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/probe_manager.cpp)
- `ProbeManager`와 `ProbeNeighborhood` 구현

 [[core_probe_batch|ProbeBatch]], [[core_probe_tree|ProbeTree]], [[core_baked_reflection_simulator|BakedReflectionSimulator]]
 - 추가 연결 부분 구현

---
# 7. Source file links

이 절은 분석 대상 파일을 파일명과 공식 저장소 링크로 정리한다. 
코드 본문은 링크에서 확인할 수 있다.

<strong style="color:#b3f594">probe_manager.h</strong>
- [probe_manager.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/probe_manager.h)

<strong style="color:#b3f594">probe_manager.cpp</strong>
- [probe_manager.cpp 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/probe_manager.cpp)

---



