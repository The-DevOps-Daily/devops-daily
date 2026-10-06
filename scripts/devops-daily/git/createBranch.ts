import { simpleGit, type SimpleGit } from 'simple-git';

/**
 * Create a new git branch
 */
export async function createBranch(branchName: string): Promise<void> {
  const git: SimpleGit = simpleGit();

  try {
    // Check if branch already exists
    const branches = await git.branchLocal();
    if (branches.all.includes(branchName)) {
      console.log(`Branch ${branchName} already exists, checking it out...`);
      await git.checkout(branchName);
      return;
    }

    // Create and checkout new branch
    console.log(`Creating new branch: ${branchName}`);
    await git.checkoutLocalBranch(branchName);
    console.log(`✓ Created and checked out branch: ${branchName}`);
  } catch (error) {
    console.error('Error creating branch:', error);
    throw error;
  }
}

/**
 * Check if working directory is clean
 */
export async function isWorkingDirectoryClean(): Promise<boolean> {
  const git: SimpleGit = simpleGit();
  const status = await git.status();
  return status.isClean();
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(): Promise<string> {
  const git: SimpleGit = simpleGit();
  const status = await git.status();
  return status.current || 'unknown';
}
