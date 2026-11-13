---
title: ReadMe
author: KurtJang
tags:
  - "#Books"
date: 2025-12-31
draft: "true"
---

> [!NOTE] 
> 요약

---
<font color="#92d050">Table Of Contents</font>

- [Table of Contents](#table-of-contents)
- [ETC](#etc)
	- [Installed plugin list](#installed-plugin-list)

---

# How To Setup

1. Git clone
``` cpp fold title:Cmd
// git clone (kurtPage)
git congit@github.com:jsukjin/KurtPage.git
```

2. Node.js Install (없을 경우)
- https://nodejs.org/en/download

2. Create Quartz
- https://quartz.jzhao.xyz
``` cpp fold title:Cmd
// git clone
git clone (mygit)

// npm install
npm i

//create quartz
npx quartz create

```

4. Git Setup
- https://quartz.jzhao.xyz/setting-up-your-GitHub-repository
``` cpp fold title:Cmd
//list all the repositories that are trackedgit 
git remote -v

//if the origin doesn't match your own repository, 
//set your repository as the origin
git remote set-url origin REMOTE-URL

//if you don't have upstream as a remote, add it so updates work
git remote add upstream https://github.com/jackyzha0/quartz.git

```

- 셋업 이후 git remote -v를 통해 아래와 같이 origin / upstream 이 셋업됨을 확인
![[quartz_setup_git_result.png|300]]

---

# ETC
## Installed plugin list

- Excalidraw
- DataView
- Templater
- Advanced Tables
- Editing Toolbar
- Recent Files
- Table of Contents
- Automatic Table of Contents
- Code Styler
- Share tnoe
- Image converter
- better pdf export
- style setting
---