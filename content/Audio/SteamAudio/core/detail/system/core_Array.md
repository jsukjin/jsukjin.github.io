---
title: "[Core] Array"
author: KurtJang
tags:
  - Blog
  - "#Programming"
  - "#SteamAudio"
  - "#CPP"
date: 2026-05-07
draft: "False"
description: "[SteamAudio] Array class 분석 (core module)"
---

---

# 1. Array

- 다차원 배열을 메모리 연속으로 저장하면서 `arr[i][j][k]`  문법을 유지하는 클래스

``` cpp fold title:Steam Audio C++
// 일반 C++ 다차원 배열의 문제
float** arr = new float*[3];    //여러 번 할당

for (int it = 0; i < 3; i++)
{
	arr[i] = new float[4];
}

//ipl::array
Array<float, 2> arr(3,4);    //한번에 연속 할당
arr[1][2] = 7.0f;            //문법 그대로 SIMD 가능
```

---

# 2. 구성 요소

> [!info] info
> `Array<T,N>`  - N 차원 배열 일반 버전 (recursive)
> `Array<T,1>` - 1차원 특수화 (재귀 종료)
>
> 멤버 변수
> - `mSize`  - 마지막 차원 크기
> - `mElements` - 실제 데이터 (연속 메모리)
> - `mPointers` - 다차원 접근용 포인터 배열
> - `mSizes[N]` - 각 차원 크기 저장

``` cpp fold title:Steam Audio C++
//마지막 차원 크기
//(3 * 4) 배열이면 mSize = 4
size_t mSize;

//실제 데이터 (힙에 연속으로 할당)
//SIMD 정렬 보장
unique_ptr<T[]> mElements;

//재귀적 포인터 배열
//arr[i][j] 접근을 위한 구조
Array<T*, N-1> mPointers;

//각 차원 크기 기록
//size(dim) 함수에서 사용
size_t mSizes[N];
```

---

# 3. 함수별 분석
``` cpp fold title:Steam Audio C++

//기본 생성자 = 0 인 이유?
// resize() 전에 안전한 상태 보장 (nullptr 체크 가능)
template <typename T, size_t N = 1>
class Array
{
public:
	size_t mSize;
	unique_ptr<T[]> mElements;
	Array<T*, N -1> mPointers;
	size_t mSizez[N];

Array()
	: mSize(0)
	, mElements(nullptr)
	, mPointers()
{}

//크기 생성자
template <typename S, typename... Sizes>
Array(S size, Sizes... sizes)
{
	//이유 : resize에 위임 -> 코드 중복 제거
	//Array<float,2> arr(3,4) 처럼 직관적 생성
	resize(size, sizez...);
}

~Array() {}

template <typename S, typename... Sizes>
void resize(S size, Sizes... sizes)
{
	//1. sizes를 배열로 변환
	auto sizeList = {Size...};
	auto sizeArray = sizeList.begin();

	//2. 각 차원 크기 기록
	mSizez[0] = size;
	for (auto i = 0; i < N; ++i)
	{
	  mSizez[i] = sizArray[i - 1];
	}

	//3. 마지막 차원 크기 저장
	mSize = sizeArray[N - 2];

	//4. 총 원소 수 계산
	auto numElements = size;
	for (auto i = 0; i < N -1; ++i)
	{
		numElements *= sizeArray[i];
	}

	//5. 연속 메모리 한번에 저장
	mElements = ipl::unique_ptr<T[]> (numElements);

	//6. 포인터 배열 recursive resize
	mPointers.resize(size, sizes...);

	//7. 포인터 연결 - **중요**
	auto stride = mSize;

	// mSize > 0 체크 이유
	// 크기 0 배열일때 0으로 나누기 방지
	// i < numElements / mSize 일때 mSize 0 이면 crash
	for (auto i = 0u; mSize > 0 && i < numElements / mSize; ++i)
	{
	    mPointers.mElements[i] = &mElements[i * stride];
	}
}
//const 버전 - read only
const auto& operator[] (const int i) const
{
	return data()[i];
}

//non-const 버전 - read/write
auto& operator[] (const int i)
{
    return data()[i];
}

size_t size(const int dim) const
{
	//이유 : 재귀적으로 각 차원 크기 반환
	//dim == N -1  (마지막 차원) -> mSize 반환
	// 그외의 경우 mPointers 에 위임 (재귀)
	return (dim == N -1) ? mSize : mPointers.size(dim);
}

size_t totalSize() const
{
	//전체 원소수 = 모든 차원의 크기의 곱
	//zero(), SIMD 처리에서 전체 크기 필요
	size_t result = 1;
	for (auto i = 0; i < N; ++i)
	{
	    result *= size(i);
	}
	return result;
}

//floatData - 연속 메모리 직접 접근
//이유 : SIMD 처리, memset 등에서 1차 포인터로 전체 접근 필요
const T* floatData() const
{
	return mElements.get();
}

T* flatData()
{
	return mElements.get();
}

//data() - 다차원 포인터 접근
//이유 : arr[i][j][k] 문법 지원
//      operator[]가 이걸 통해 동작
auto data() const
{
	return mPointers.data();
}

auto data()
{
	return mPointers.data();
}

/*
 * flatData() -> T* 항상 1d pointer
 * data() -> T** 2D / T*** 3D 등 차원에 따라 다름
 *
 * flatData() 사용 : zero(), SIMD, memcpy
 * data() 사용 : arr[i][j][k] 접근
*/


void zero()
{
	/* 메모리가 연속이라 memset 한번으로 전체 초기화 가능
	 * SIMD도 가능 */
	std::memset(flatData(), 0, totalSize() * sizeof(T));
}

/* swap
 * 복사 없이 두 배열의 내용을 교환
 * 실제 데이터 이동 없이 포인터만 교환
 * 오디오 더블 버퍼링에서 핵심적으로 사용
*/
void swap(Array<T,N>& other)
{
	std:swap(mSize, other.mSize);
	mElements.swap(other.mElements); //unique_ptr swap
	mPointers.swap(other.mPointers); //recursive swap

	for (auto i = 0; i < N; ++i)
	{
	    std::swap(mSizez[i], other.mSizes[i]);
	}
}

} // end of class Array<T,N>


/*
 * 일반 버전과 다른점
 * mPointers 없음  - (재귀 정료)
 * mSizes 없음     - 차원이 1개임
 * resize() 단순   - mSize + mElements 만 설정
 * data()         - mElements.get() 직접 반환
 * operator[]     - data()[i] = T& 직접 반영
*/
template <typename T>
class Array<T,1>
{
public:
	size_t mSize;
	unique_ptr<T[]> mElements;

Array()
	: mSize(0)
	, Elements(nullptr)
{}

templae <typename T, typename... Sizes>
Array(S size, Sizes... sizes)
{
	resize(size, sizes);
}

~Array() {}

template <typename T, typename... Sizes>
void resize(S size, Sizes... sizes)
{
	mSize = size;
	mElements = ipl::make_unqiue<T[]>(mSize);
}

cosnt T& operator[](const int i ) const
{
	return data()[i];
}

T& operator[] (const int i)
{
	return data()[i];
}

size_t size(const int dim) const
{
	return mSize;
}

size_t totalSize() const
{
	return size(0);
}

const T* flatData() const
{
	return mElements.get();
}

T* flatData() const
{
	return mElements.get();
}

auto data()
{
	return mElements.get();
}

void zero()
{
	std::memset(flatData(), 0 ,totalSize() * sizeof(T));
}

void swap(Array<T,1>& other)
{
	std::swap(mSize, other.mSzie);
	mElements.swap(other.mElements);
}

} //end of class Array<T,1>
```
---


<strong style="color:#b3f594">array.h</strong>
- [array.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/array.h)

# 4. 예제 코드

## 1. Array<float, 2> (3,4)

``` cpp fold title:Steam Audio C++
// Array<float, 2> (3,4) 예제
size = 3 , sizes = 4
mSizes = [3,4];
mSize = 4;
numElements = 12;

mElements = [value,value,value,value,value,value,
             value,value,value,value,value,value] // 12개 연속

mPointers.resize(3,4) // Array<float*,1> 에 3개 포인터 할당

stride = 4;
//i = 0
mPointers.mElements[0] = &mElements[0];    //행 0 시작

//i = 1
mPointers.mElements[1] = &mElements[4];    //행 1 시작

// i = 2
mPointers.mElements[2] = &mElements[8];    //행 2 시작

```

## 2. Array<float,3> (2,3,4)

``` cpp fold title:Steam Audio C++
// T = flaot, N = 3
// size = 2 , sizes = {3,4}

// step 1 - resize(2,3,4) 진입

auto sizeList = {Size...};          // {3,4}
auto sizeArray = sizeList.begin();
//sizeArray[0] = 3
//sizeArray[1] = 4

//2. 각 차원 크기 기록
mSizez[0] = size;
for (auto i = 0; i < N; ++i)
{
	mSizez[i] = sizArray[i - 1];
}
//mSizes[0] = size;           //mSizes[0] = 2
//mSizes[1] = sizeArray[0];   //mSizes[1] = 3
//mSizes[2] = sizeArray[1];   //mSizes[2] = 4

//3. 마지막 차원 크기 저장
mSize = sizeArray[N - 2];
//mSize = sizeArray[3 - 2] = mSizeArray[1]
//mSize = 4


//4. 총 원소 수 계산
auto numElements = size;
for (auto i = 0; i < N -1; ++i)
{
	numElements *= sizeArray[i];
}
//auto numElements = size;        //2
//numElements *= sizeArray[0];    //2 * 3 = 6
//numElements *= sizeArray[1];    //6 * 4 = 24


//5. 연속 메모리 한번에 저장
mElements = ipl::unique_ptr<T[]> (numElements);
//메모리 layout (면 기준)
//면0][0] = {0,1,2,3}
//면[0][1] = {4,5,6,7}
//면[0][2] = {8,9,10,11}
//면[1][0] = {12,13,14,15}
//면[1][1] = {16,17,18,19}
//면[1][2] = {20,21,22,23}

//6. 포인터 배열 recursive resize
mPointers.resize(size, sizes...);
//Array<flot* 2>.resize(2,3,4)
// 2 * 3 = 6개 float* 포인터 배열 생성
// Array<float**,1>.resize(2,3,4)
// 2개 float** 포인터 배열 생성

//7. 포인터 연결 - **중요**
auto stride = mSize;
//stride = 4

for (auto i = 0u; mSize > 0 && i < numElements / mSize; ++i)
{
	mPointers.mElements[i] = &mElements[i * stride];
}

//numElements / mSize = 24 / 4 = 6
//i=0 -> mPointers.mElements[0] = &mElements[0]  [0][0] 시작
//i=1 -> mPoinetrs.mElements[1] = &mElements[4]  [0][1] 시작
//i=2 -> mPointers.mElements[2] = &mElements[8]  [0][2] 시작
//i=3 -> mPointers.mElements[3] = &mElements[12] [1][0] 시작
//i=4 -> mPointers.mElements[4] = &mElements[16] [1][1] 시작
//i=5 -> mPointers.mElements[5] = &mElements[20] [1][2] 시작

```

---
# 5. Conclusion


> [!info] 요약
> `Array<float,3> (2,3,4)` <br>
> `mElements` : float x 24 (연속, 실제 데이터) <br>
> `mPointers` : Array<float* 2> <br>
> `arra[i][j][k]`
> - `float**[i]` 면 -> `float*[j]` 행  -> `float[k]` 원소
>
>


![[SteamAudio-Array 구조.webp]]

---
