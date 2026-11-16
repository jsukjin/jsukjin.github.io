---
title: "[Core] SIMD"
author: KurtJang
tags:
  - Blog
  - "#Programming"
  - "#CPP"
  - "#SteamAudio"
date: 2026-05-12
draft: "False"
description: "[SteamAudio] SIMD 구조 분석"
---
---

# 1. <strong style="color:#b3f594">SIMD</strong>


<strong style="color:#b3f594">SIMD = Single Instruction Multiple Data</strong>란?
-  CPU가 하나의 명령어로 여러 데이터를 동시에 처리하는 기술 
- 일반적 CPU는 하나의 데이터를 처리하지만 SIMD를 사용하면 한번에 여러 데이터를 
  처리할 수 있어 <strong style="color:#ffb15b">연산속도 크게 향상</strong> 크게 향상 된다 
- 오디오, 그래픽, 물리 시뮬레이션 처럼 동일한 연산을 대량으로 데이터에 반복 적용하는 
  분야에서 핵심 최적화 기술로 사용된다

---

# 2. 장단점

## 1. 비교

``` cpp fold title:Steam Audio C++
float a[4] = {1.0f, 2.0f, 3.0f, 4.0f};
float b[4] = {5.0f, 6.0f, 7.0f, 8.0f};

//일반 버전
a[0] + b[0] //연산 횟수 1
a[1] + b[1] //연산 횟수 2
a[2] + b[2] //연산 횐수 3
a[3] + b[3] //연산 횟수 4

//SIMD
__m128 a = _mm_loadu_ps(a);
__m128 b = _mm_loadu_ps(b);

__m128 result = _mm_add_ps(a,b); //연산 횟수 1
```

## 2. 버전

> [!info] SIMD 버전
> - MMX (1996)     : 정수 8개 동시 처리 (64 bit)
> - SSE   (1999)     : float 4개 동시 처리 (128 bit)
> - SSE2 (2001)     : doueble 2개 동시 처리 (128 bit)
> - SSE4 (2007)     : 추가 명령어 확장
> - AVX  (2011)     : float 8개 동시 처리 (256 bit)
> - AVX512 (2016) : float 16개 동시 처리 (512 bit)
> - NEON (ARM)   : float 4개 동시 처리 (128 bit)

---

## 3. 장점

<strong style="color:#b3f594">1. 처리속도 향상</strong>

- SSE  : 이론상 4배 빠름 (float 4개 동시)
- AVX : 이론상 8배 빠름 (float 8개 동시)
- AVX512 : 이론상 16배 빠름 (float 16개 동시)

<strong style="color:#b3f594">2. 전력 효율</strong>

- 같은 작업을 더 적은 전력으로 처리 (4번 명령 -> 1번 명령)
- 모바일/노트북 배터리 절약

<strong style="color:#b3f594">3. 캐시 효율</strong> - 연속된 메모리를 한번에 로드 - 캐시 히트율 향상 - 메모리 접근 횟수 감소

## 4. 단점

<strong style="color:#b3f594">1. 정렬 제약</strong> 

- SSE -> 16 byte 정렬 필요 - AVX -> 32 byte 정렬 필요 -
- <font color="#b3f594">메모리 할당 시 반드시 정렬 고려</font> - <font color="#b3f594">정렬이 안맞으면 crash 또는 성능 저하</font>

<strong style="color:#b3f594">2. 플랫폼 종속성</strong> 

- SSE/AVX -> x86/x64 전용 (INTEL, AMD) - NEON  
- ARM 전용 (모바일, Apple Silicon) - 플랫폼마다 별도 구현 필요


> [!info]
> 연산속도 향상으로 인하여 오디오/그래픽처럼 반복 연산에서는 <font color="#b3f594">SIMD는 필수 이다</font>
> 

---

# 3. 예제 코드

## SSE

``` cpp fold title:Steam Audio C++
#include <xmmintrin.h>
#include <emmintrin.h>

void sse_example()
{
    // 배열 선언 (16바이트 정렬)
    alignas(16) float a[4] = {1.0f, 2.0f, 3.0f, 4.0f};
    alignas(16) float b[4] = {5.0f, 6.0f, 7.0f, 8.0f};
    alignas(16) float result[4];

    // __m128 = float 4개짜리 SIMD 레지스터
    __m128 va = _mm_load_ps(a);   // {1, 2, 3, 4} 로드
    __m128 vb = _mm_load_ps(b);   // {5, 6, 7, 8} 로드

    // 4개 동시 덧셈
    __m128 vr = _mm_add_ps(va, vb);
    // vr = {6, 8, 10, 12}

    // 결과 저장
    _mm_store_ps(result, vr);
    // result = {6.0f, 8.0f, 10.0f, 12.0f}

    // 스칼라 비교 (일반 루프)
    // 1+5=6, 2+6=8, 3+7=10, 4+8=12
    printf("SSE: %.0f %.0f %.0f %.0f\n",
        result[0], result[1], result[2], result[3]);
}

```

## SSE2

``` cpp fold title:Steam Audio C++
#include <emmintrin.h>

void sse2_example()
{
    // double 2개 동시 처리
    alignas(16) double a[2] = {1.5, 2.5};
    alignas(16) double b[2] = {3.5, 4.5};
    alignas(16) double result[2];

    // __m128d = double 2개짜리 레지스터
    __m128d va = _mm_load_pd(a);
    __m128d vb = _mm_load_pd(b);
    __m128d vr = _mm_add_pd(va, vb);
    // vr = {5.0, 7.0}

    _mm_store_pd(result, vr);
    printf("SSE2 double: %.1f %.1f\n", result[0], result[1]);

    // int 4개 동시 처리
    alignas(16) int ia[4] = {1, 2, 3, 4};
    alignas(16) int ib[4] = {5, 6, 7, 8};
    alignas(16) int ir[4];

    // __m128i = int 4개짜리 레지스터
    __m128i via = _mm_load_si128((__m128i*)ia);
    __m128i vib = _mm_load_si128((__m128i*)ib);
    __m128i vir = _mm_add_epi32(via, vib);
    // vir = {6, 8, 10, 12}

    _mm_store_si128((__m128i*)ir, vir);
    printf("SSE2 int: %d %d %d %d\n", ir[0], ir[1], ir[2], ir[3]);
}
```


## AVX

``` cpp fold title:Steam Audio C++
#include <immintrin.h>

void avx_example()
{
    // 32바이트 정렬 필요
    alignas(32) float a[8] = {1,2,3,4,5,6,7,8};
    alignas(32) float b[8] = {8,7,6,5,4,3,2,1};
    alignas(32) float result[8];

    // __m256 = float 8개짜리 레지스터
    __m256 va = _mm256_load_ps(a);
    __m256 vb = _mm256_load_ps(b);

    // 8개 동시 덧셈
    __m256 vr = _mm256_add_ps(va, vb);
    // vr = {9,9,9,9,9,9,9,9}

    _mm256_store_ps(result, vr);
    printf("AVX: ");
    for (int i = 0; i < 8; ++i)
        printf("%.0f ", result[i]);
    printf("\n");
}
```


## NEON

``` cpp fold title:Steam Audio C++
#include <arm_neon.h>

void neon_example()
{
    float a[4] = {1.0f, 2.0f, 3.0f, 4.0f};
    float b[4] = {5.0f, 6.0f, 7.0f, 8.0f};
    float result[4];

    // float32x4_t = float 4개짜리 NEON 레지스터
    float32x4_t va = vld1q_f32(a);   // 로드
    float32x4_t vb = vld1q_f32(b);   // 로드

    // 4개 동시 덧셈
    float32x4_t vr = vaddq_f32(va, vb);
    // vr = {6, 8, 10, 12}

    vst1q_f32(result, vr);            // 저장
    printf("NEON: %.0f %.0f %.0f %.0f\n",
        result[0], result[1], result[2], result[3]);
}
```

---

## 4. 실제 코드

``` cpp fold title:Steam Audio C++
//float4.h

//cpu에 따라 sse/neon simd 헤더 첨부

#if defined(IPL_CPU_X86) || defined(IPL_CPU_X64)
#include "sse_float4.h"
#elif (defined(IPL_CPU_ARMV7) || defined(IPL_CPU_ARM64))
#include "neon_float4.h"
#endif

//sse_flaot4.h
//SSE 용으로 header 구현
typedef __m128 float4_t;

namespace float4
{
    // Returns a + b.
    inline float4_t add(float4_t a,
                        float4_t b)
    {
        return _mm_add_ps(a, b);
    }
}

//neon_float.h
typedef float32x4_t float4_t;

namespace float4
{
    // Returns a + b.
    inline float4_t add(float4_t a,
                        float4_t b)
    {
        return vaddq_f32(a, b);
    }
}


```



---

# 5. Tips

- alignment 체크
``` cpp fold title:Steam Audio C++

/*
	SIMD가 16의 배수 float을 DSP에서 사용하여 연산하기 때문에
    이를 활용한 trick으로 0xf 값(15)를 넣어서 아래 자리수의 마침을 통해서
    alignment 여부 체크

	주소 = 16 (0001 0000)
	0xf  =    (0000 1111)
	           ─────────
	AND  =    (0000 0000) = 0  ← 정렬됨 ✅

	주소 = 32 (0010 0000)
	0xf  =    (0000 1111)
	           ─────────
	AND  =    (0000 0000) = 0  ← 정렬됨 ✅

	주소 = 64 (0100 0000)
	0xf  =    (0000 1111)
	           ─────────
	AND  =    (0000 0000) = 0  ← 정렬됨 ✅

	주소 = 17 (0001 0001)
	0xf  =    (0000 1111)
			   ─────────
	AND  =    (0000 0001) = 1  ← 정렬 안됨 ❌

	주소 = 18 (0001 0010)
	0xf  =    (0000 1111)
			   ─────────
	AND  =    (0000 0010) = 2  ← 정렬 안됨 ❌

	주소 = 21 (0001 0101)
	0xf  =    (0000 1111)
			   ─────────
	AND  =    (0000 0101) = 5  ← 정렬 안됨 ❌

** 16배수가 아닐 경우 & 에서 숫자가 나오게 되므로 그걸 토대로 alignment 를 체크
*/

template <typename T>
inline bool isAligned(const T* p)
{
	return ((reinterpret_cast<size_t>(p) & 0xf) == 0);
}

```

> [!info] SIMD 헤더 파일 목록
>- <mmintrin.h> - MMX
>- <xmmintrin.h> - SSE
>- <emmintrin.h> - SSE2
>- <pmmintrin.h> - SSE3
>- <smmintrin.h> - SSE4.1
>- <nmmintrin.h> - SSE4.2
>- <immintrin.h> - AVX, AVX2, AVX512
>- <arm_neon.h> - NEON (ARM)
>

---
# 6. Source file links


<strong style="color:#b3f594">avx_float8.h</strong>
- [avx_float8.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/avx_float8.h)

<strong style="color:#b3f594">float4.h</strong>
- [float4.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/float4.h)

<strong style="color:#b3f594">float8.h</strong>
- [float8.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/float8.h)

<strong style="color:#b3f594">neon_float4.h</strong>
- [neon_float4.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/neon_float4.h)

<strong style="color:#b3f594">sse_float4.h</strong>
- [sse_float4.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/sse_float4.h)


---
