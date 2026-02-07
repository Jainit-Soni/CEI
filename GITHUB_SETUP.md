# How to Create a New GitHub Repository for This Project

Follow these steps to upload your entire project (`backend` + `frontend`) to a new GitHub repository.

## Prerequisites
- You must have **Git** installed. (Download from [git-scm.com](https://git-scm.com/downloads) if needed).
- You must have a **GitHub account**.

---

## Step 1: Prepare the Folder (The Clean Up)

We want one single repository for both `backend` and `frontend`. To avoid issues, we must ensure there are no nested git repositories.

1.  Open your project folder `e:\CMAT-PROBLEM` in File Explorer.
2.  **Enable "Hidden Items"**: View tab -> Check "Hidden items".
3.  **Check for `.git` folders**:
    - Look inside `e:\CMAT-PROBLEM\frontend`. If you see a `.git` folder, **delete it**.
    - Look inside `e:\CMAT-PROBLEM\backend`. If you see a `.git` folder, **delete it**.
    - This ensures we start fresh with a clean slate.

---

## Step 2: Initialize Git

1.  Open your terminal (VS Code terminal is fine) at the root folder: `e:\CMAT-PROBLEM`.
2.  Run the following commands:

```sh
# Initialize a new git repository
git init

# Add all files to staging
git add .
```

*Note: This might take a moment as it scans all files. If you see warnings about line endings (LF vs CRLF), you can ignore them.*

3.  Commit the files:

```sh
git commit -m "Initial commit: Project setup with frontend and backend"
```

---

## Step 3: Create Repository on GitHub

1.  Go to [github.com/new](https://github.com/new).
2.  **Repository name**: `cmat-problem-monorepo` (or any name you like).
3.  **Description**: "Next.js frontend and Node.js backend for CMAT college comparison platform."
4.  **Public/Private**: Choose **Public** (easier for deployment) or **Private**.
5.  **Initialize**: **DO NOT** check any boxes (Add README, .gitignore, License). We want an empty repository.
6.  Click **Create repository**.

---

## Step 4: Connect and Push

Once created, GitHub will show you a page with commands. Look for the section **"…or push an existing repository from the command line"**.

1.  Copy the commands shown. They will look like this (replace `YOUR_USERNAME` with your actual username):

```sh
git remote add origin https://github.com/YOUR_USERNAME/cmat-problem-monorepo.git
git branch -M main
git push -u origin main
```

2.  Paste and run these commands in your terminal.
3.  **Authenticate**: If asked, sign in to GitHub in the browser window that pops up.

---

## Step 5: Verification

1.  Refresh your GitHub repository page.
2.  You should see your folders: `backend`, `frontend`, `GITHUB_SETUP.md`, etc.

**Success!** Your code is now safely on GitHub and ready for deployment.
