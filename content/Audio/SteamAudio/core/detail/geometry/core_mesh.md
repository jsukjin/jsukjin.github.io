---
title: "[Core] Mesh"
author: KurtJang
tags:
  - Blog
  - "#Programming"
  - CPP
  - SteamAudio
date: 2026-05-19
draft: "False"
description: "[SteamAudio] mesh (core module)"
---

---

# 1. 개념

- vertex 배열  + triangle 배열 + 벡터 배열을 보관하는 3D 메시 컨테이너
- `StaticMesh`  가 material을 담당하고 `Mesh` 는 순수 기하 데이터만 담당한다

---

# 2. 구성 요소

- `Vector4f` 
	- vertex 좌표
- `Triangle` 
	-  vertex 인덱스 저장
	- 인덱스 3개로 하나의 면을 정의
- `Vector3f` 
	- Nomal 벡터

> [!info] 특이사항
> vertex가 `Vector3f` 가 아닌 `vector4f` 인 이유?
> - <strong style="color:#b3f594">BVH</strong> 레이트레이싱에서 <strong style="color:#b3f594">SIMD</strong> 연산시 16bye alignment가 필요하다
> - `Vector3f` 는 12byte라 정렬이 안맞아서 `w = 1.0f` 를 붙여 `vector4f`로 포현

## 2.1 Mesh가 만들어지는 과정

![[steamaudio_core_mesh.webp]]

### A. Vertex

- 3D 공간의 점 하나 (x,y,z)

``` cpp fold title:Steam Audio C++
Vector3f vertex = {1.0f, 1.0f, 1.0f}
```

### B. Triangle

- vertex 3개의 index 면(face)로 하나를 정의한다
- 좌표를 직접 저장하지 않고 vertex  배열의 index만을 쓴다
``` cpp fold title:Steam Audio C++
Triangle tri  {0,1,2} // vertices[0], vertices[1], vertices2[]로 면 정의
```

### C. Mesh

- vertex + triangle + material의 집합
``` cpp fold title:Steam Audio C++
CreateMesh(numVertices,        //num of vertex
           numTriangles,       //num of triangle
           numMaterials,       //num of material
           vertices,           //vector3f array
           triangles,          //trinagle (index) array
           materialIndices,    //materials per triangle
           materials);         //mateiral array
```

---

# 3. 예제 코드

``` cpp fold title:Steam Audio C++

//trinagle 1ea짜리 mesh 만들기
Vector3f vertices[] = {
{0.0f, 0.0f, 0.0f},    //v0
{1.0f, 0.0f, 0.0f},    //v1
{0.5f, 1.0f, 0.0f},    //v2

Triangle tirangles[] = {0,1,2} // v0->v1->v2

Mesh mesh (3,1,vertices, triangels)

//접근
mesh.vertex(0);               //(0,0,0)
mesh.triangles.indices[1];    //1 (v1 index)
mesh.normal(0);               //(0,0,1)

//triangle의 실제 vertex 좌표 바로 가져오기
mesh.triangleVertex(0,1);
//triangle[0]의 두번째 꼭지좜 좌표 v1 = (1,0,0)

```

---

<strong style="color:#b3f594">mesh.h</strong>
- [mesh.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/mesh.h)

<strong style="color:#b3f594">mesh.cpp</strong>
- [mesh.cpp 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/mesh.cpp)

<strong style="color:#b3f594">static_mesh.h</strong>
- [static_mesh.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/static_mesh.h)

<strong style="color:#b3f594">static_mesh.cpp</strong>
- [static_mesh.cpp 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/static_mesh.cpp)

<strong style="color:#b3f594">material.h</strong>
- [material.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/material.h)

<strong style="color:#b3f594">triangle.h</strong>
- [triangle.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/triangle.h)

---
# 4. 실전 코드

``` cpp fold title:Steam Audio C++
// -----------------------------------------------------------------------
// 생성자 — 버텍스/트라이앵글 배열로 직접 생성
// 예시: 방 메시 numVertices=8, numTriangles=12
// -----------------------------------------------------------------------
Mesh::Mesh(int numVertices,
           int numTriangles,
           const Vector3f* vertices,
           const Triangle* triangleIndices)
    : mVertices(numVertices)   // Array<Vector4f> 크기 할당
    , mTriangles(numTriangles) // Array<Triangle> 크기 할당
    , mNormals(numTriangles)   // 트라이앵글마다 법선 1개
{
    for (auto i = 0; i < numVertices; ++i)
    {
        // Vector3f → Vector4f 변환 (w=1.0 패딩)
        // BVH SIMD 연산에서 16바이트 정렬 필요
        // 예시: (1.0, 0.5, 0.0) → (1.0, 0.5, 0.0, 1.0)
        mVertices[i] = Vector4f(vertices[i].x(), vertices[i].y(), vertices[i].z(), 1.0f);
    }

    for (auto i = 0; i < numTriangles; ++i)
    {
        mTriangles[i] = triangleIndices[i];
        // 예시: triangleIndices[0] = {0, 1, 2} → mTriangles[0] = {0, 1, 2}
    }

    calcNormals(); // 생성 직후 법선 자동 계산
}

// -----------------------------------------------------------------------
// calcNormals() — 트라이앵글별 법선벡터 자동 계산
//
// 법선벡터 = 두 모서리 벡터의 외적(cross product) → 정규화
// 예시:
//   V0=(0,0,0) V1=(1,0,0) V2=(0,1,0) 일 때
//   edge1 = V1 - V0 = (1, 0, 0)
//   edge2 = V2 - V0 = (0, 1, 0)
//   cross(edge1, edge2) = (0, 0, 1) → 정규화 → (0, 0, 1)
//   → 이 트라이앵글은 Z축 방향을 향하고 있음
// -----------------------------------------------------------------------
void Mesh::calcNormals()
{
    for (auto i = 0; i < numTriangles(); ++i)
    {
        const auto& v0 = triangleVertex(i, 0); // 첫 번째 꼭짓점
        const auto& v1 = triangleVertex(i, 1); // 두 번째 꼭짓점
        const auto& v2 = triangleVertex(i, 2); // 세 번째 꼭짓점

        // 두 모서리 벡터 계산
        // cross(v1-v0, v2-v0) → 두 벡터에 수직인 벡터 = 법선
        mNormals[i] = Vector3f::unitVector(
        Vector3f::cross(v1 - v0, v2 - v0));
        // unitVector() → 크기를 1로 정규화
        // 예시: cross 결과가 (0, 0, 2) 이면 → (0, 0, 1)
    }
}

// -----------------------------------------------------------------------
// FlatBuffers 역직렬화 생성자
// 파일에서 로드한 바이트 배열로 메시 복원
// -----------------------------------------------------------------------
Mesh::Mesh(const Serialized::Mesh* serializedObject)
{
    assert(serializedObject);
    assert(serializedObject->vertices() && serializedObject->vertices()->Length() > 0);
    assert(serializedObject->triangles() && serializedObject->triangles()->Length() > 0);

    auto numVertices  = serializedObject->vertices()->Length();
    auto numTriangles = serializedObject->triangles()->Length();

    mVertices.resize(numVertices);
    mTriangles.resize(numTriangles);
    mNormals.resize(numTriangles);

    for (auto i = 0u; i < numVertices; ++i)
    {
        auto vertex = serializedObject->vertices()->Get(i);
        // FlatBuffers 포인터에서 직접 읽음 → 파싱 없음
        mVertices[i] = Vector3f(vertex->x(), vertex->y(), vertex->z());
    }

    // Triangle 배열은 memcpy 로 한 번에 복사
    memcpy(mTriangles.data(), serializedObject->triangles()->data(),
           numTriangles * sizeof(Triangle));

    calcNormals();
}

// -----------------------------------------------------------------------
// serialize() — FlatBuffers 직렬화
// Bake 결과를 파일에 저장할 때 사용
// -----------------------------------------------------------------------
flatbuffers::Offset<Serialized::Mesh> Mesh::serialize(SerializedObject& serializedObject) const
{
    auto& fbb = serializedObject.fbb();

    // 버텍스 배열을 FlatBuffers 벡터로 변환
    // CreateUninitializedVectorOfStructs → 메모리 먼저 확보, 내용은 직접 채움
    Serialized::Vector3* verticesBuffer = nullptr;
    auto verticesOffset = fbb.CreateUninitializedVectorOfStructs(numVertices(), &verticesBuffer);
    for (auto i = 0; i < numVertices(); ++i)
    {
        verticesBuffer[i] = Serialized::Vector3(vertex(i).x(), vertex(i).y(), vertex(i).z());
        // Vector4f 에서 x,y,z 만 추출 (w 버림)
    }

    // 트라이앵글 배열 직접 복사
    auto trianglesOffset = fbb.CreateVectorOfStructs(
        reinterpret_cast<const Serialized::Triangle*>(triangles()),
        numTriangles()
    );

    return Serialized::CreateMesh(fbb, verticesOffset, trianglesOffset);
}
```

---

