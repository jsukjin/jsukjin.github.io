---
title: "[Core] PathFinder"
author: KurtJang
tags:
  - Blog
  - "#Programming"
  - SteamAudio
  - CPP
date: 2026-08-11
draft: "False"
description: "PathFinder"
---

---

# 1. Introduction

<strong style="color:#b3f594">PathFinder</strong>



옆방 대화 소리가 문틈이나 복도를 타고 돌아서 들리듯,  
<strong style="color:#b3f594">소리는 벽을 뚫지 않고  열린 공간을 우회해야 자연스럽다.</strong>
Steam Audio는 맵에 probe(가상의 관측 지점)를 뿌려 서로 보이는 probe끼리 그래프를 만들고,
**PathFinder** 가 그 위에서 **소스 → 리스너로 가는 우회 경로**를 찾는다. 
원리는 게임 AI 길찾기(<strong style="color:#b3f594">Dijkstra</strong>, <strong style="color:#b3f594">A*</strong>)와 동일하고, 노드가 걷는 길이 아니라 소리가 통과할 수 
있는 공간이라는 점만 다르다.

---

# 2. 구성요소

## 2.1 ProbePath - 경로를 표현하는 자료구조

경로 계산의 **결과물**이 담기는 그릇이다. 게임 AI 길찾기의 `Path`와 완전히 같은 개념.

``` cpp fold title:Steam Audio C++
class ProbePath
{
public:
    bool valid;        // 이 경로가 유효한가?
    int start;         // 시작 probe의 인덱스
    int end;           // 끝 probe의 인덱스
    vector<int> nodes; // start와 end 사이를 잇는 중간 probe들 (순서대로)
};
```

## 2.2 Bake - `findAllShortestPaths` (전처리용)


레벨을 디자인할 때 <strong style="color:#b3f594">"이 probe에서 다른 모든 probe까지의 최단 경로"</strong> 를 미리 통째로 
계산해서 저장해두는 함수. 레벨 지오메트리는 게임 도중 안 바뀌니, 로딩 전에 미리 
구워(bake)두면 런타임 비용이 0에 가까워진다.

## 2.3 Runtime - `findShortestPath` (실시간용)

게임이 실행되는 동안, 소스나 리스너가 움직여서 
<strong style="color:#b3f594">start → end 딱 하나의 경로만 빠르게 다시 계산</strong> 할 때 쓴다. 
전체를 다 계산하는 대신 목표 지점만 보고 달려가기 때문에 훨씬 가볍다.

## 2.4 simplifyPath - 경로 다듬기

baking 때보다 런타임 가시성 범위가 더 짧아서 경로가 지그재그로 잡히는 경우, 
중간 노드를 스킵해서 경로를 매끄럽게 다듬는 후처리 함수.

---

# 3. 특이사항

## 3.1 우선, Dijkstra가 뭔가요?

길찾기 알고리즘을 처음 보는 분들을 위해 아주 기초부터 설명한다.

> [!success] 핵심 아이디어
> **"지금까지 알고 있는 것 중 가장 싼(짧은) 곳부터 하나씩 확정 짓는다."**
>
> 동네에 여러 갈림길이 있고, 각 갈림길마다 
> "여기까지 오는 데 얼마나 걸렸는지"를 적은 메모가 있다고 생각해보자.
> 
> <strong style="color:#b3f594">Dijkstra</strong>는 이 메모들 중 **가장 작은 숫자가 적힌 곳**을 골라 
> "여기까지는 확실히 이 비용이 최소야!"  라고 도장을 찍고, 
> 그다음 그 지점에서 갈 수 있는 이웃들의 메모를 다시 갱신한다.
> 이 과정을 모든 곳에 도장을 찍을 때까지 반복할 뿐이다.
> 

아래는 5개의 지점(S, 1, 2, 3, End)이 있는 아주 작은 지도에서, 
Dijkstra가 실제로 한 걸음씩 진행되는 과정이다.

![[path_finder_dijkstra_concept.svg|660]]

- **1단계**: 시작점 S는 당연히 비용 0으로 확정.
- **2단계**: S에서 갈 수 있는 곳 중, 아직 확정 안 된 곳들의 메모(1번=2.0, 2번=5.0) 중 
  **가장 작은 1번**을 확정.
- **3단계**: 1번에서 다시 갈 수 있는 3번까지 비용(2.0+1.0=3.0)을 계산해서, 
  역시 미확정 노드 중 제일 싼 3번을 확정.
- **4단계**: 3번을 거쳐 End까지 비용(3.0+2.0=5.0)을 계산해서 확정. 이렇게 도착!

즉 <strong style="color:#b3f594">Dijkstra</strong>는 "어디로 가야 목적지에 빨리 갈지" 같은 건 전혀 모른 채, 
<strong style="color:#b3f594">그냥 매번 지금까지 가장 싼 곳부터</strong> 차례로 넓혀나갈 뿐이다.

## 3.2 그럼 A*는 뭔가요?

> [!success] 핵심 아이디어
> <strong style="color:#b3f594">A*</strong>는 <strong style="color:#b3f594">Dijkstra</strong>에 딱 한 가지를 더한 것뿐이다.
> **"목적지가 어느 방향에 있는지 대략적인 감(heuristic, h)"** 을 미리 알고 시작한다.
>
> 예를 들어 지도 위에서 두 지점 사이의 **직선거리**를 재보면, 실제로 길을 따라가는 거리가 
> 이보다 짧을 수는 없다. 이 "최소한 이만큼은 가야 한다"는 하한선을 비용에 더해서
> (`f = g + h`, g=지금까지 온 비용, h=목적지까지 남은 대략 거리),
> 
> 그 값이 작은 노드부터 먼저 살펴본다. 그러면 목적지와 관련 없는 방향은 
> 자연스럽게 덜 살펴보게 된다.


같은 지도에서 <strong style="color:#b3f594">A*</strong>가 어떻게 다르게 움직이는지 살펴보자.

![[path_finder_astar_concept.svg|683]]

- **1단계**: 시작 전에 이미 각 노드에서 End까지 대략 얼마나 남았는지(h)를 알고 있다.
- **2단계**: 1번 노드는 `f = g(2) + h(4) = 6`, 2번 노드는 `f = g(5) + h(5) = 10`.
	    **더 작은 1번을 먼저 선택.**
- **3단계**: 1번 → 3번 → End로 쭉 이어져서 도착. **2번 쪽은 한 번도 안 가봤다!**

<strong style="color:#b3f594">Dijkstra</strong>는 2번 노드의 비용(5.0)까지 계산해야 했지만, <strong style="color:#b3f594">A*</strong>는 애초에 2번 방향이
End와 별로 상관없다는 걸 힌트로 알고 있었기 때문에 아예 살펴보지 않아도 되었다. 
이게 바로 <strong style="color:#b3f594">A*</strong>가 <strong style="color:#b3f594">Dijkstra</strong>보다 빠른 이유다.

## 3.3 Dijkstra vs A* - Steam Audio는 왜 함수를 두 개로 나눴을까

- <strong style="color:#b3f594">Dijkstra</strong> (`findAllShortestPaths`) 
	- 목적지가 없다. "모든 곳"이 목적지이기 때문에 힌트(h)를 쓸 수가 없다. 
	  그래서 지금까지 온 비용(cost)만 보고 골고루 넓게 퍼져나간다.

- <strong style="color:#b3f594">A*</strong> (`findShortestPath`) 
	- 목적지(`end`)가 정해져 있다. 그래서 "지금까지 온 비용 + end까지 남은
	  대략적인 거리(휴리스틱, h)" 를 함께 보고, **end 방향에 가까운 쪽을 먼저** 살펴본다.


Steam Audio에서 실제 6개의 probe로 이루어진 그래프를 놓고 비교하면 다음과 같다.

![[path_finder_dijkstra_vs_astar.svg|579x302]]

**Dijkstra**(왼쪽)
- end라는 개념이 없으므로 모든 **probe**(A~E)를 빠짐없이 방문한

**A*(오른쪽)**
- End와 거리가 먼 B, D 쪽 가지는 우선순위가 낮아져서 
  방문 순서가 한참 밀리고, End가 큐에서 뽑히는 순간 곧바로 탐색을 멈춘다. 

<strong style="color:#ffb15b">필요한 부분만 계산한다는 것이 A*의 핵심이다</strong>


> [!info] 정리 - 언제 뭘 쓰나
>
> | | <strong style="color:#b3f594">Dijkstra</strong> (`findAllShortestPaths`) | <strong style="color:#b3f594">A*</strong> (`findShortestPath`) |
> |---|---|---|
> | 언제 | 레벨 로딩 전, 베이킹(bake) 시점 | 게임 실행 중, 실시간 |
> | 목적 | start → **모든** probe까지 경로 | start → **하나의** end까지 경로 |
> | 정렬 기준 | 지금까지의 비용(cost)만 | 비용 + end까지의 남은 거리(휴리스틱) |
> | 종료 조건 | 큐가 완전히 빌 때까지 | end가 큐에서 나오는 즉시 |


## 3.4 `std::priority_queue`를 min-heap처럼 쓰는 트릭

`std::priority_queue`는 기본적으로 **가장 큰 값**이 먼저 나오는 max-heap이다. 
그런데 <strong style="color:#b3f594">Dijkstra</strong>/<strong style="color:#b3f594">A*</strong>는 **가장 비용이 싼(작은) 노드**를 먼저 꺼내야 한다.

Steam Audio는 별도의 비교 클래스를 만드는 대신, `operator<` 하나를 뒤집는 식으로 
이 문제를 해결한다.

``` cpp fold title:Steam Audio C++
bool operator<(const PathFinder::PriorityQueueEntry& lhs,
               const PathFinder::PriorityQueueEntry& rhs)
{
    return (lhs.cost > rhs.cost); // 부등호를 반대로!
}
```


> [!tip] 어떻게 작동하는 건가요?
> `priority_queue`는 내부적으로 `a < b`가 참이면 "a는 b보다 덜 중요하다"고 
> 판단해서  b를 위로 올린다.****
> 
> 그런데 여기서는 `lhs.cost > rhs.cost`를 `lhs < rhs`라고 정의해버렸다.
> 즉 "**cost가 더 큰 애가 사실은 덜 중요한 애다**"라고 뒤집어 알려준 셈이라, 
> 결과적으로 **cost가 가장 작은 노드가 매번 top()으로 올라온다.**
> 새 클래스 없이 헤더 한 줄로 min-heap을 흉내내는, C++에서 자주 쓰이는 
> 관용적인 트릭이다.


## 3.5 simplifyPath - 지그재그 경로 다듬기

`findShortestPath`
- 찾은 경로는 실시간 가시성 범위가 짧아서 필요 이상으로 꺾여 있을 수 있다

`simplifyPath`
- 경로 위의 연속된 세 점(`i`, `i+1`, `i+2`)을 보고, **`i`에서 `i+2`가 
  직접 보이면 `i+1`을 통째로 건너뛴다.**


![[path_finder_simplify_path.svg|668]]

> [!tip] 왜 이 과정이 필요한가요?
> 위 그림처럼 원래 경로는 S → P1 → P2 → P3 → End 로 지그재그였지만,
> S에서 P2가 바로 보이고, P2에서 End도 바로 보이기 때문에 최종적으로 S → P2 → End 로 단순화된다.
> 지그재그 경로를 그대로 오디오 처리에 쓰면 EQ나 딜레이 값이 미세하게 떨리는(chattering) 현상이 생기기 쉬운데,
> 이 후처리 덕분에 훨씬 자연스러운 사운드 전파를 만들 수 있다.


<strong style="color:#b3f594">path_finder.h</strong>
- [path_finder.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/path_finder.h)

<strong style="color:#b3f594">path_finder.cpp</strong>
- [path_finder.cpp 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/path_finder.cpp)

---
# 4. 예제 코드

Steam Audio의 probe 그래프를 아주 작게 흉내낸 5개짜리 그래프에서, 
"**S에서 각 노드까지의 최단 비용**"을 구하는 미니 <strong style="color:#b3f594">Dijkstra</strong> 

예제. (위 3.1의 그림과 동일한 지도다.)

``` cpp fold title:Steam Audio C++
#include <iostream>
#include <vector>
#include <queue>
#include <limits>

struct Edge { int to; float cost; };

int main()
{
    // 5개의 probe(0~4)로 이루어진 아주 작은 그래프
    // 0(S) - 1 : 2.0,  0(S) - 2 : 5.0,  1 - 3 : 1.0,  2 - 3 : 1.0,  3 - 4(End) : 2.0
    std::vector<std::vector<Edge>> graph(5);
    graph[0] = { {1, 2.0f}, {2, 5.0f} };
    graph[1] = { {0, 2.0f}, {3, 1.0f} };
    graph[2] = { {0, 5.0f}, {3, 1.0f} };
    graph[3] = { {1, 1.0f}, {2, 1.0f}, {4, 2.0f} };
    graph[4] = { {3, 2.0f} };

    std::vector<float> cost(5, std::numeric_limits<float>::infinity());
    cost[0] = 0.0f; // 시작점(S)의 비용은 0

    // {비용, 노드번호} 쌍을 저장. cost가 작은 순서로 꺼내지도록 greater<> 사용
    std::priority_queue<std::pair<float, int>,
                        std::vector<std::pair<float, int>>,
                        std::greater<>> pq;
    pq.push({ 0.0f, 0 });

    while (!pq.empty())
    {
        auto [curCost, u] = pq.top();
        pq.pop();

        // 이미 더 싼 값으로 처리된 노드라면 무시
        if (curCost > cost[u]) continue;

        for (const auto& edge : graph[u])
        {
            float newCost = cost[u] + edge.cost;
            if (newCost < cost[edge.to])
            {
                cost[edge.to] = newCost;
                pq.push({ newCost, edge.to });
            }
        }
    }

    for (int i = 0; i < 5; ++i)
        std::cout << "probe " << i << " 까지의 최단 비용: " << cost[i] << "\n";

    return 0;
}
```

> [!tip] 결과
> `probe 4 (End) 까지의 최단 비용: 5.0`  
> S(0) → 1 → 3 → 4 경로 (2.0 + 1.0 + 2.0 = 5.0)가
> S(0) → 2 → 3 → 4 경로(5.0 + 1.0 + 2.0 = 8.0)보다 싸므로, 
> 실제로는 **S → 1 → 3 → 4** 경로가 선택된다.
> 
> (3.1의 그림에서 본 것과 정확히 같은 순서로 확정되는 걸 확인할 수 있다.)

`PathFinder::findAllShortestPaths`는 이 코드에서 `std::greater<>` 대신 
`operator<`를 뒤집는 트릭을 쓰고, 결과를 담는 그릇이 `float`가 아니라 
`ProbePath`(경로 전체)라는 점만 다를 뿐, 알고리즘의 뼈대는 완전히 동일하다.

---

# 5. 실전 코드

아래 구현 발췌는 경로 탐색 흐름을 보여준다. 파일명 옆 링크를 열면
Steam Audio 공식 저장소에서 각 원본 파일을 확인할 수 있다.

- 헤더: <strong style="color:#b3f594">path_finder.h</strong> [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/path_finder.h)
- 구현: <strong style="color:#b3f594">path_finder.cpp</strong> [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/path_finder.cpp)
- 그래프 정의: <strong style="color:#b3f594">path_visibility.h</strong> [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/path_visibility.h)

## 5.1 Bake - `findAllShortestPaths` (Dijkstra)

``` cpp fold title:Steam Audio C++
// path_finder.cpp

void PathFinder::findAllShortestPaths(..., int start, ..., ProbePath* paths) const
{
    // 1. 초기화: 모든 노드의 비용을 무한대로, 부모를 없음(-1)으로
    for (auto i = 0; i < probes.numProbes(); ++i)
    {
        mParents[threadIndex][i] = -1;
        mCosts[threadIndex][i] = std::numeric_limits<float>::infinity();
    }
    mCosts[threadIndex][start] = 0.0f;

    // 2. start 노드부터 우선순위 큐에 push
    mPriorityQueue[threadIndex].push({ start, 0.0f });

    // 3. 큐가 빌 때까지 "가장 비용이 싼 노드"를 계속 꺼내며 확장(relax)
    while (!mPriorityQueue[threadIndex].empty())
    {
        auto u = mPriorityQueue[threadIndex].top().nodeIndex;
        mPriorityQueue[threadIndex].pop();

        // u와 연결된 이웃 노드 v들을 순회
        for (const auto& entry : visGraph.mAdjacent[u])
        {
            auto v = entry.index;
            auto newCost = mCosts[threadIndex][u] + entry.cost;

            // pathRange를 넘어가면 아예 후보에서 제외 (탐색 범위 제한)
            if (newCost > pathRange) continue;

            // 기존에 알던 비용보다 더 싸게 갈 수 있다면 갱신
            if (newCost < mCosts[threadIndex][v])
            {
                mCosts[threadIndex][v] = newCost;
                mParents[threadIndex][v] = u;   // "v로 오려면 u를 거쳐왔다"
                mPriorityQueue[threadIndex].push({ v, newCost });
            }
        }
    }
    // 4. 이후 모든 노드에 대해 parents 배열을 거꾸로 따라가며 ProbePath를 복원한다
}
```


## 5.2 Runtime - `findShortestPath` (A*)

``` cpp fold title:Steam Audio C++
// path_finder.cpp

auto ProbeDistance = [&probes](int start, int end) -> float
{
    // 두 probe의 실제 3D 직선거리. 이게 A*의 휴리스틱(h) 역할을 한다
    return (probes[start].influence.center - probes[end].influence.center).length();
};

while (!mPriorityQueue[threadIndex].empty())
{
    auto u = mPriorityQueue[threadIndex].top().nodeIndex;

    // ★ end를 "확정"짓는 순간, 더 볼 것도 없이 바로 종료
    if (u == end) break;

    mPriorityQueue[threadIndex].pop();

    for (const auto& entry : visGraph.mAdjacent[u])
    {
        auto v = entry.index;
        auto newCost = mCosts[threadIndex][u] + entry.cost;

        if (mCosts[threadIndex][v] == infinity || newCost < mCosts[threadIndex][v])
        {
            // 런타임에는 baked visGraph보다 더 촘촘하게 실시간 가시성 재검사 가능
            if (realTimeVis && !visTester.areProbesVisible(scene, probes, u, v, radius, threshold))
                continue;

            mCosts[threadIndex][v] = newCost;
            mParents[threadIndex][v] = u;

            // ★ 큐에는 "지금까지 비용" + "v에서 end까지 남은 거리(휴리스틱)"를 합쳐서 push
            //    → end 방향과 관련없는 가지는 우선순위가 낮아져서 자연스럽게 덜 탐색됨
            mPriorityQueue[threadIndex].push({ v, newCost + ProbeDistance(v, end) });
        }
    }
}
```


## 5.3 simplifyPath - 경로 다듬기

``` cpp fold title:Steam Audio C++
// path_finder.cpp

auto current = end;
while (current != start && current >= 0)
{
    while (true)
    {
        auto parent = parents[current];
        if (parent < 0) break;

        auto grandparent = parents[parent];
        if (grandparent < 0) break;

        // current 입장에서 조부모(grandparent)가 직접 보이는지 검사
        bool visible = realTimeVis
            ? visTester.areProbesVisible(scene, probes, current, grandparent, radius, threshold)
            : visGraph.hasEdge(current, grandparent);

        if (!visible) break; // 안 보이면 더 이상 스킵 불가, 멈춤

        // 보인다면 부모를 조부모로 교체 → 중간(parent) 노드는 경로에서 제외됨
        parents[current] = grandparent;
    }

    current = parents[current];
}
```

> [!info] <strong style="color:#b3f594">Dijkstra</strong>는 왜 실시간 가시성 재검사(`realTimeVis`)가 없나요?
> `findAllShortestPaths`는 **베이킹 시점**에만 실행되고, 이때는 레벨이 정적이라고 
> 가정하기 때문에 `visGraph`(미리 계산된 <strong style="color:#b3f594">가시성 그래프</strong>)만 믿고 계산해도 충분하다.
> 
>  반면 `findShortestPath`는 게임 실행 중 동적으로 열리는 문, 움직이는 장애물 등을 
>  반영해야 하므로 `realTimeVis` 옵션으로 매번 레이 캐스트 재검증이 가능하게 되어 있다.
> 

---

# 6. Summary



1. <strong style="color:#b3f594">PathFinder</strong>는 게임 AI 길찾기 알고리즘(<strong style="color:#b3f594">Dijkstra</strong>/<strong style="color:#b3f594">A*</strong>)을 **소리의 전파 경로 찾기**에 
   그대로 재사용한 모듈이다.

2.  **Bake**(<strong style="color:#b3f594">Dijkstra</strong>)는 정적인 레벨에서 모든 probe까지의 경로를 미리 구해두고, 
    **Runtime**(<strong style="color:#b3f594">A*</strong>)은 움직이는 대상만 그때그때 빠르게 계산한다.
    
3. 비용(cost) 함수 자리에 소리의 감쇠/<strong style="color:#b3f594">회절</strong> 값을 끼워넣은 것이 이 모듈의 진짜 
   아이디어이며, 알고리즘 자체는 표준적인 <strong style="color:#b3f594">Dijkstra</strong>/<strong style="color:#b3f594">A*</strong>와 동일하다.

---

