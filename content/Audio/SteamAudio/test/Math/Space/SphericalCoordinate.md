---
title: spherical_coordinate
author: KurtJang
tags:
  - Blog
date: 2026-05-13
draft: "true"
description: 구면 좌표계 (spherical coordinate system)
---

---

# 1. 구면 좌표계

- 3D 공간의 위치를 distance 1개와 angle 2개로 표현하는 좌표계
- 직교 좌표계 (catesian) 이 <font color="#b3f594">"얼마나 이동했는가?"</font>에 중점
- 구면 좌표계(spherical) 는 <font color="#b3f594">"얼마나 멀리, 어느 방향인가"</font> 로 표현

``` cpp
직교 좌표계 → (x, y, z)     축 방향 거리 3개
구면 좌표계 → (r, φ, θ)     거리 1개 + 방위각 + 앙각
```

![[Math_Spherical_intro_01.webp]]

---

# 2. 구성 요소

<strong style="color:#b3f594">1. Radius (r)</strong>

-  원점에서의 거리

``` cpp
r = sqrt (x^2 + y^2 + z^2)
```

<strong style="color:#b3f594">2. azimuth (φ)</strong> - 수평 방위각
``` cpp
φ = atan2(y,x)
// 정면 0 , 왼쪽 PI/2 , 후방 PI , 오른쪽 3PI/2
```

<strong style="color:#b3f594">3. elevation (θ)</strong> - 수직 양각
``` cpp
θ = atan2(x, sqrt(x^2 + y^2))
// 수평 = 0, 정수직 위 = PI /2
```

|      | Cartesian       | Spherical       |
| ---- | --------------- | --------------- |
| 표현   | (x,y,z)         | (r, φ, θ)       |
| 장점1  | 덧셈 / 뺄셈 연산 간단   | 방향 /각도 추출 직관적   |
| 장점2  | 선형 보간 쉬움        | 거리 계산 간단 (r 하나) |
| 단점1  | 각도 계산시 atan2 필요 | 덧셈 / 뺄셈 보간 복잡   |
| 단점2  | 방향 판별이 직관적이지 않음 | Gimbal Lock 주의  |
| 주 용도 | 위치 연산, 벡터 내적/외적 | 방향 판멸, HRTF     |

---

# 3. 예제 코드

- `atan2(y,x)` 를 쓰는 이유
	- `atan(y/x)` 는 x = 0일때 division by zero 발생
	- `atan2` 는 두 연수를 받아 사분면 까지 정확히 반환

``` cpp
#include <cmath>

struct Spherical
{
	float r;
	float azimuth;
	float elevation;
}

Spherical cartesianToSpherical(float x, float y , float z)
{
	Spehrical s{};
	s.r = std::sqrt (x * X + y * y + z * z);

	if (s.r > 1e-6f)
	{
		    s.azimuth = std::atn2f(y,x);                      //수평 방위각
	    s.elevation = std::atan2f(z, std::qrt (x*X + 쌍을 판별하는 패턴
``` cpp
#inlcude <cmath>
#include <algorithm>

struct SphericalVector3f {
    float radius;
    float azimuth;
    float elevation

explicit SphericalVector3f(float x, float y, float z) {
    radius = std::sqrt(x*x + y*y + z*z);

    if (radius > 1e-6f)
    {
        //수평면 투영 후 방위각 계산
        azimuth = std::atanf(x,z);
        elevation = std::asinf(y / radius);
    }
    else
    {
        azimuth = elevation = 0.0f;
    }
} };


void calcPairwisePanningData(float dirX, float dirY, float dirZ) {
    SphericalVector3f polar (dirX, dirY, dirZ);

    //elevation은 무시 - 스피커가 수평면에 있기 때문에
    //azimuth만 꺼내서 스피꺼 한쌍 판별
    float phi = std::max(0.0f, polar.azimuth);

    //phi 범위로 인접한 쌍 결정 (5.1 surround 기준)
	// 0 ~ PI/4           -> front-left / center 사이
	// PI/4 ~ 3PI/4       -> rear-left / front-left 사이
	// 3PI/4 ~ 5PI/4      -> rear-right / rear-left 사이
	// 5PI/4 ~ 7PI/4      -> front-right / rear-right 사이
	// 7PI/4 ~            -> center / front-right 사이
}

```








---

<font color="#b3f594">1. 역할 분리</font> <font color="#b3f594">1. 역할 분리</font> <font color="#b3f594">1. 역할 분리</font>
<font color="#b3f594">1. 역할 분리</font>


들여쓰기

<details> <summary>여기를 클릭해서 내용을 확인하세요 (제목)</summary> <div markdown="1">

이곳에 펼쳐질 내용을 작성합니다. - 리스트도 가능하고 - **굵은 글씨**도 가능합니다.

  </div>
</details>


%% 옵시디언에서만 보이는 주석 %%


<font color="#2ecc71">초록색 텍스트</font> <font color="#3498db">파란색 텍스트</font> <font color="#ff4d4d">빨간색 텍스트</font>
<font color="#ffa500">주황색 텍스트</font> <font color="#f1c40f">노란색 텍스트</font>

<font color="#b3f594">■ 이미지의 그 초록색 (연두)</font> <font color="#80dfff">■ 시원한 밝은 파란색</font> <font color="#ff6b6b">■ 예쁜 다홍빛
빨간색</font> <font color="#ffb15b">■ 질문하신 주황색</font> <font color="#ffff80">■ 눈 안 아픈 부드러운 노란색</font>

<strong style="color:#b3f594">연두색 (이미지 속 그 색상)</strong> <strong style="color:#80dfff">밝은 하늘색 (정보/참고)</strong> <strong style="color:#ff6b6b">다홍색
(주의/경고)</strong> <strong style="color:#ffb15b">주황색 (핵심 키워드)</strong> <strong style="color:#ffff80">부드러운 노란색 (강조)</strong>

# Code Example
``` cpp fold title:Cmd
au.3dVisualize.Listeners 1
```

``` cpp fold title:subject
int a = 1; int b = 2; a + b 3;
```


# Callout Example > [!info] info > Contents

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
