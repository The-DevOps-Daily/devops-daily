import { simpleGit, type SimpleGit } from 'simple-git';

/**
 * Commit and push changes
 */
export async function commitAndPush(
  filePath: string,
  commitMessage: string,
  branchName: string
): Promise<void> {
  const git: SimpleGit = simpleGit();

  try {
    // Add the file
    console.log(`Adding file: ${filePath}`);
    await git.add(filePath);

    // Commit
    console.log(`Committing: ${commitMessage}`);
    await git.commit(commitMessage);

    // Push with upstream
    console.log(`Pushing to origin/${branchName}...`);
    await git.push('origin', branchName, ['--set-upstream']);

    console.log(`✓ Successfully committed and pushed to ${branchName}`);
  } catch (error) {
    console.error('Error committing and pushing:', error);
    throw error;
  }
}

/**
 * Stage and commit file
 */
export async function commit(filePath: string, message: string): Promise<void> {
  const git: SimpleGit = simpleGit();

  try {
    await git.add(filePath);
    await git.commit(message);
    console.log(`✓ Committed: ${message}`);
  } catch (error) {
    console.error('Error committing:', error);
    throw error;
  }
}

/**
 * Push to remote
 */
export async function push(branchName: string): Promise<void> {
  const git: SimpleGit = simpleGit();

  try {
    await git.push('origin', branchName, ['--set-upstream']);
    console.log(`✓ Pushed to origin/${branchName}`);
  } catch (error) {
    console.error('Error pushing:', error);
    throw error;
  }
}
