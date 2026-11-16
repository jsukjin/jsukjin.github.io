---
title: "[Core] BVH"
author: KurtJang
tags:
  - Blog
  - "#Programming"
  - SteamAudio
  - CPP
date: 2026-06-22
draft: "False"
description: "[SteamAudio] BVH 분석 (core module)"
---

---

# 1. Introduction

## <strong style="color:#b3f594">BVH</strong> (Bounding Volume Hierarchy)

![[core_bvh-1782879266800.webp|650x294]]

- 트리구조 (N개의 삼각형, 2N-1개의 노드)

> [!info]  예제
> 만약 총알이 어떤 벽이나 메시에 맞았는지 판단해야 한다면?
> 그리고 맵에 100만개의 삼각형이 있다면?
>
> 100만번의 충돌검사는 엄청난 비효율
> 따라서 <font color="#b3f594">"큰 상자안에 작은 상자들을 계층적으로 집어넣는 방법"</font>이 바로 BVH
>
> 원리
>  - 먼저 전체 맵을 감싸는 거대한 상자(Root)를 만든다
>  - 그 상자를 반씩 쪼개 나아가며 작은 상자들을 만든다
>  - 맨 마지막 (leaf) 안에는 실제 물체 (삼각형)이 들어있게 된다
> <br>
>
>효과
> - 광선이 가장 큰 상자를 통과하지 못했다면
>   그안의 100만개 삼각형은 검사도 안하고 통째로 건너 뛸 수 있다
> - 이 덕분에 성능이 O(N)에서 O(logN)으로 획기적으로 줄어듬
>
>


---
# 2. 구성 요소

<strong style="color:#b3f594">1. Box</strong>

- min, max로 표현 - Steam Audio 의 경우 SIMD를 위해 vector4를 사용하며 
- padding 4byte의 경우 메타데이터를 끼워넣어서 메모리 효율화를 한다 - 
- 마지막 bit - 3이면 = internal node - 0~2면 = leaf node의 axis (0 = x, y = 1, z = 2)

![[core_bvh-1782879327715.webp]]

<strong style="color:#b3f594">2. BVHNode</strong>

- internal node일 경우
	- 알맹이(삼각형)이 없고 자식 노드를 가리키는 포인터/오프셋역할
- leaf node일 경우
	- 트리 구조의 맨끝에 존재하며, 실제 삼각형의 인덱스 번호를 가지고 있는 상자

---
# 3. 예제 코드

``` cpp fold title:Steam Audio C++
#inlcude <iostream>
#include <vector

struct SimpleBox{
    float minX, minY;

	bool intersect(float rayX) const
	{
	    return ray x >= minX && rayX <= maxX;
	}
}

struct SimpleBVHNode{
    SimpleBox box;
    bool isLeaf;
	int triangleIndex;   //leaf node일때만 유효(실제 삼각형 번호)
    int leftChild, rightChild; // internal node일때만 유효(자식 위치)
}

void intersectRay(const std::vector<SimpleBVHNode>& bvh,
                  int nodeIdx,
                  float rayX)
{
    //1. 현재 상자에 부딪히지도 않았따면 하위 상자들을 볼 필요 없음
    if (!node.box.intersect(rayX)) return;

    //2. 만약 leaf node라면 드디어 실제 trinagle과 충돌을 확인
    if (node.isLeaf)
    {
        std::cout << "충돌 노드" << node.triangleIndex << "번 삼각형";
        return;
    }

    //3. internal node라면 자식 상자들을 내부적으로 타고 내려감
    //recursive
    intersectRay(bvh, node.leftChild, reyX);
    intersectRay(bvh, node.rightChild, rayX);
}

int main()
{
    SimpleBVHNode rootNode = SimpleBVHNode();
    root.box = SimlpeBox(0.0f, 10.0f);
    root.isLeaf = false;
    root.triangleIndex = -1;
    root.leftChild = 1;
    root.rightChild = 2;

    //leaf node (left)
    SimpleBVHNode lNode = SimpleBVHNode();
    lNode.box = SimpleBox (0.0f, 5.0f);
    lNode.isLeaf = true;
    lNode.triangleIndex = 99;
    lNode.leftChild = -1;
    lNode.rightChild = -1;

    //leaf node (right)
    SimpleBvhNode rNode = SimpleBVHNode();
    rNode.box = SimpleBox(0.0f, 10.0f);
    rNode.isLeaf = true;
    rNode.triangleIndex = 100;
    rNode.leftChild = -1;
    rNode.rightChild = -1;

    std::vector<SimpleBVHNode> dummyBVH;
    dummyBVH.push_back(rootNode);
    dummyBVH.push_back(lNode);
    dummyBVH.push_back(rNode);

    float fakeRayPosition = 3.0f;
    std::cout << "location = " << fakeRayPostiion << "ray ges";
    intersectRay(dummyBVH, 0, fakeRayPosition);

    return 0;
}


```

---

# 3. 실전 코드

<strong style="color:#b3f594">bvh.h</strong>
- [bvh.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/bvh.h)

<strong style="color:#b3f594">bvh.cpp</strong>
- [bvh.cpp 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/bvh.cpp)

<strong style="color:#b3f594">box.h</strong>
- [box.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/box.h)

<strong style="color:#b3f594">hit.h</strong>
- [hit.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/hit.h)

<strong style="color:#b3f594">ray.h</strong>
- [ray.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/ray.h)

<strong style="color:#b3f594">ray.cpp</strong>
- [ray.cpp 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/ray.cpp)

<strong style="color:#b3f594">sphere.h</strong>
- [sphere.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/sphere.h)

---
