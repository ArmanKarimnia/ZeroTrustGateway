import JSZip from 'jszip';
import { REPOSITORY_FILES } from '../data/repositoryFiles';

export async function downloadRepositoryZip(): Promise<void> {
  const zip = new JSZip();

  // Add all project files into the zip preserving exact relative paths
  for (const file of REPOSITORY_FILES) {
    zip.file(file.path, file.content);
  }

  // Also include the full README.md content if available
  const blob = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = 'zero-trust-apisix-keycloak.zip';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(downloadUrl);
}
