---
title: "[Core] Octree 기반 Probe 생성"
author: KurtJang
tags: [Blog, "#Programming", "#CPP", "#SteamAudio"]
date: 2026-11-12
draft: "False"
description: "octree leaf node를 probe sphere로 만드는 독립 생성 함수와 호출 연결 상태"
---
---
# 1. 역할

`generateOctreeProbes`는 OBB 영역을 감싸는 world AABB를 만든 뒤 `Octree`를 구성하고,
leaf node마다 center/radius를 가진 Probe를 만든다. 
UniformFloor처럼 바닥 ray hit를 찾아 높이를 적용하는 방식과 다르다.

---
# 2. 구현 흐름

1. local OBB의 8개 corner를 world transform으로 변환한다.
2. 8점으로 world AABB를 확장한다.
3. `Octree(scene, box, spacing)`으로 geometry와 spacing 기준 octree를 만든다.
4. 내부 node를 제외하고 leaf만 후보로 선택한다.
5. node center와 half diagonal을 sphere center/radius로 저장한다.


``` cpp fold title:octree leaf에서 Probe sphere 생성
if (!octree.getNode(i).isLeaf())
    continue;

if (!box.contains(octree.getNode(i).box.center()))
    continue;

probes[i].influence.center = node.box.center();
probes[i].influence.radius = 0.5f * node.box.extents().length();
```

node의 축별 half extent vector 길이를 반으로 나눈 값은 box의 center를 중심으로 
전체 node box를 포함하는 sphere radius다. 
현재 검사하는 범위는 AABB다. 원본 코드 주석도 AABB/OBB containment 또는 box-box 검사
개선 가능성을 TODO로 남긴다.

---
# 3. 호출 연결 확인

`ProbeGenerationType::Octree`는 probe_generator.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/probe_generator.h) enum에 있지만
`ProbeGenerator::generateProbes` switch에는 case가 없다. 
검색한 `core/src/core`와 benchmark 호출에서 `generateOctreeProbes`를 부르는 곳도 없다. 
따라서 **이 함수는 구현되어 있으나 현재 일반 ProbeGenerator/API 흐름에는 연결되지 않은 
별도 함수**로 문서화한다. 연결되어 있다고 추정해서 사용법을 설명하면 안된다.

---
# 4. 사용 관점

이 함수는 public `ProbeGenerationType` dispatch에 연결되어 있지 않으므로, 일반
`iplProbeArrayGenerateProbes` 호출에서 Octree 생성을 선택할 수 있다고 안내하지 않는다.
내부에서 직접 사용하려면 octree_probes.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/octree_probes.h) 선언을 포함하고 유효한 Scene, OBB 
transform, 양수 spacing, 출력 ProbeArray를 전달해야 한다.

---
# 5. 독립 C++ 핵심 예제

``` cpp fold title:octree leaf 대표점으로 sphere 만들기
#include <cmath>

struct ProbeSphere { float x, y, z, radius; };
struct Extents { float x, y, z; };

ProbeSphere sphereForBox(float x, float y, float z, Extents halfExtent)
{
    const float radius = 0.5f * std::sqrt(halfExtent.x * halfExtent.x +
                                          halfExtent.y * halfExtent.y +
                                          halfExtent.z * halfExtent.z);
    return {x, y, z, radius};
}
```

Core는 이 반대각선 길이의 절반을 사용한다. 예제는 octree leaf box를 완전히 포함하는 
sphere를 만드는 개념만 보여주며, 실제 tree 분할이나 scene occupancy를 구현하지 않는다.

---

# 6. Source file inventory

아래 파일명 옆의 링크를 열면 Steam Audio 공식 저장소에서 원본을 확인할 수 있다.

<strong style="color:#b3f594">octree_probes.h</strong>
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/octree_probes.h)

<strong style="color:#b3f594">octree_probes.cpp</strong>
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/octree_probes.cpp)

<strong style="color:#b3f594">probe_generator.h</strong>
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/probe_generator.h)

<strong style="color:#b3f594">probe_generator.cpp</strong>
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/probe_generator.cpp)

---
