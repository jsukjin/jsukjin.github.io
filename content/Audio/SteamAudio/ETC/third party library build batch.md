---
title: third party library build patch
author: KurtJang
tags:
  - Blog
  - "#Programming"
  - CPP
  - SteamAudio
date: 2026-05-11
draft: "True"
description: "third party library build /배포 하는 batch 시스템 (python, bat)"
---

---
# 1. 구조

작업에 필요한 third party library를 다운/빌드/배포는 다음과 같은 방식으로 이루어 진다

> [!info]
> 1. GItHub 저장소
> 2. 내 PC에 다운로드
> 3. 빌드 (Cmake)
> 4. 필요한 파일만 골라서 별도의 폴어 (deps)에 정리

* Phonon_itest.exe 를 빌드 할려면 GLFW, IMGui 등이 필요하다
- 이 라이브러리들은  내 프로젝트에 포함되어 있지 않으니 외부에서 가져와야 한다

---

# 2. 전체 흐름

> [!info]
> 1. feath  - Github에서 소스코드 다운로드 (git clone)
> 2. configure - CMake로 visual studio 프로젝트 생성
> 3. build - Visual Studio로 실제 compile -> .lib 생성
> 4. copy - 헤도 + .lib 만 골라서 별도의 폴더에 정리

---

# 3. 단계별 실제 동작

## 1. fetch - git clone
``` cpp
git clonse https://github.com/PortAudio/protaudio.git
git checkout 147d772... //특정 버전 고정
```

## 2. configure - CMake 프로젝트 생성
``` cpp
cmake -G "Visual Studio 17 2022" -A x64
	  -S deps-build/portaudio/src/portaudio      // 소스
	  -B deps-build/portaudio/build/windows-x26  //출력
```

## 3. Build - 컴파일
``` cpp
cmake --build deps-build/portaudio/build/windows-x64 --config Release

//결과 Release 폴더에 portaudio_static_x64.lib 생성
```

## 4. Install - 정리
``` cpp
cmake --install deps-build/portaudio/build/windows-x64 --config Release

//deps-build/portaudio/install/windows-x64/ include/portaudio.h lib/portaudio_static_x64.lib
```


## 5. copy - 지정폴더로 복사
``` python
# itest_dependencies.jon의 copy 하옴ㄱ
["$install/include", "include"]
["$install/lib", "lib/$platform/$config"]

#install = deps-build/portaudio/install/windows-x64
#결과
# portaudio.h lib 파일을 지정폴더로 복사
```

---

# 4. 배포 automation

- 배치파일로는 git clon, cmake 호출 등 복잡한 처리가 불가능하기에 python으로 자동화 작업의 효율을 올리기 위하여 python으로 작업 되었다

## 1. 예제 코드

``` python
# build_mylib.py
# mylib 을 GitHub 에서 받아서 빌드 후 deps/ 에 정리

import os
import shutil
import stat
import subprocess

# ============================================================
# 설정값
# ============================================================

GIT_URL  = "https://github.com/example/mylib.git"
GIT_TAG  = "v1.2.3"            # 버전 고정 (main 브랜치 쓰면 버전이 바뀔 수 있음)
LIB_NAME = "mylib"
PLATFORM = "windows-x64"

# 경로 정의
ROOT_DIR    = os.getcwd()
SRC_DIR     = os.path.join(ROOT_DIR, "deps-build", LIB_NAME, "src",     LIB_NAME)
BUILD_DIR   = os.path.join(ROOT_DIR, "deps-build", LIB_NAME, "build",   PLATFORM)
INSTALL_DIR = os.path.join(ROOT_DIR, "deps-build", LIB_NAME, "install", PLATFORM)
DEPS_DIR    = os.path.join(ROOT_DIR, "deps",        LIB_NAME)

# ============================================================
# 헬퍼 함수
# ============================================================

def make_dir(path):
    """폴더가 없으면 생성"""
    os.makedirs(path, exist_ok=True)

def run(cmd):
    """명령어 실행. 실패하면 예외 발생"""
    print(f"\n>> {' '.join(cmd)}")
    subprocess.check_call(cmd)

def remove_readonly(func, path, _):
    """git 폴더 삭제 시 읽기전용 파일 처리"""
    os.chmod(path, stat.S_IWRITE)
    func(path)

# ============================================================
# 1단계 — fetch (git clone)
#
# GitHub 에서 소스코드 전체를 다운로드
# 이미 있으면 스킵
# ============================================================

def fetch():
    print("\n[1/4] fetch — git clone")

    src_parent = os.path.dirname(SRC_DIR)
    make_dir(src_parent)

    if os.path.exists(SRC_DIR):
        print(f"  이미 클론됨: {SRC_DIR}")
        return

    # git clone https://github.com/example/mylib.git
    run(["git", "clone", GIT_URL, LIB_NAME], cwd=src_parent)

    # git checkout v1.2.3 — 특정 버전으로 이동
    run(["git", "checkout", GIT_TAG], cwd=SRC_DIR)

    print("  fetch 완료")

# ============================================================
# 2단계 — configure (cmake)
#
# CMake 가 소스를 분석해서 Visual Studio .sln 파일 생성
# -S = 소스 폴더 (CMakeLists.txt 위치)
# -B = 빌드 출력 폴더
# -G = Visual Studio 버전
# -A = 아키텍처 (x64)
# ============================================================

def configure():
    print("\n[2/4] configure — cmake 프로젝트 생성")

    make_dir(BUILD_DIR)
    make_dir(INSTALL_DIR)

    run([
        "cmake",
        "-G", "Visual Studio 17 2022",
        "-A", "x64",
        # 설치 경로 — cmake --install 시 여기로 파일이 정리됨
        f"-DCMAKE_INSTALL_PREFIX={INSTALL_DIR}",
        # 소스 폴더 (CMakeLists.txt 가 여기 있음)
        "-S", SRC_DIR,
        # 빌드 출력 폴더 (.sln 이 여기 생성됨)
        "-B", BUILD_DIR,
        # 라이브러리 옵션 예시 — .dll 대신 .lib 만 빌드
        "-DMYLIB_BUILD_SHARED=OFF",
        "-DMYLIB_BUILD_TESTS=OFF",
    ])

    print("  configure 완료")
    print(f"  .sln 생성됨: {BUILD_DIR}")

# ============================================================
# 3단계 — build (cmake --build)
#
# Visual Studio 컴파일러로 실제 빌드
# --config Release = Release 모드로 빌드
# 결과: BUILD_DIR/Release/mylib.lib
# ============================================================

def build():
    print("\n[3/4] build — 컴파일")

    run([
        "cmake",
        "--build", BUILD_DIR,
        "--config", "Release",
    ])

    print("  build 완료")
    print(f"  .lib 생성됨: {BUILD_DIR}/Release/")

# ============================================================
# 4단계 — install + copy
#
# cmake --install : 빌드 결과물을 INSTALL_DIR 로 정리
#   결과:
#     install/windows-x64/include/mylib.h
#     install/windows-x64/lib/mylib.lib
#
# copy : INSTALL_DIR 에서 deps/ 로 필요한 것만 복사
#   결과:
#     deps/mylib/include/mylib.h
#     deps/mylib/lib/release/mylib.lib
# ============================================================

def install_and_copy():
    print("\n[4/4] install + copy — deps 폴더로 정리")

    # cmake --install — 헤더 + 라이브러리를 INSTALL_DIR 로 정리
    run([
        "cmake",
        "--install", BUILD_DIR,
        "--config", "Release",
    ])

    print(f"  install 완료: {INSTALL_DIR}")

    # INSTALL_DIR 에서 deps/ 로 복사
    src_include = os.path.join(INSTALL_DIR, "include")
    src_lib     = os.path.join(INSTALL_DIR, "lib")

    dst_include = os.path.join(DEPS_DIR, "include")
    dst_lib     = os.path.join(DEPS_DIR, "lib", PLATFORM, "release")

    # 헤더 복사
    if os.path.exists(src_include):
        if os.path.exists(dst_include):
            shutil.rmtree(dst_include, onerror=remove_readonly)
        shutil.copytree(src_include, dst_include)
        print(f"  헤더 복사: {dst_include}")

    # 라이브러리 복사
    if os.path.exists(src_lib):
        make_dir(dst_lib)
        for f in os.listdir(src_lib):
            if f.endswith(".lib"):
                shutil.copy(os.path.join(src_lib, f), dst_lib)
                print(f"  lib 복사: {f} -> {dst_lib}")

    print("\n  최종 결과:")
    print(f"  {dst_include}/mylib.h")
    print(f"  {dst_lib}/mylib.lib")

# ============================================================
# 메인
# ============================================================

def main():
    print(f"Working directory: {ROOT_DIR}")
    print(f"Library: {LIB_NAME}")
    print(f"Platform: {PLATFORM}")

    try:
        fetch()
        configure()
        build()
        install_and_copy()

        print("\n============================================================")
        print("  완료!")
        print(f"  deps/{LIB_NAME}/ 에서 확인하세요.")
        print("============================================================")

    except subprocess.CalledProcessError as e:
        print(f"\n실패: {e}")
        print("위 에러 메시지를 확인하세요.")

if __name__ == "__main__":
    main()
```
