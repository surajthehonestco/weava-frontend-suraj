import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FolderService {
  private refreshFoldersSubject = new Subject<void>();
  refreshFolders$ = this.refreshFoldersSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const user = localStorage.getItem('user');
    if (!user) throw new Error('User not found in localStorage');

    const parsedUser = JSON.parse(user);
    return new HttpHeaders().set('Authorization', `Bearer ${parsedUser.authToken}`);
  }

  getFolders(): Observable<any> {
    return this.http.get<any>('https://weavadev1.azurewebsites.net/folders', {
      headers: this.getAuthHeaders()
    });
  }

  createFolder(title: string): Observable<any> {
    const folderData = { title };
    return this.http.post('https://weavadev1.azurewebsites.net/folders/root', folderData, {
      headers: this.getAuthHeaders()
    });
  }

  deleteFolder(folderId: string): Observable<any> {
    return this.http.delete(`https://weavadev1.azurewebsites.net/folders/${folderId}`, {
      headers: this.getAuthHeaders()
    });
  }

  acceptInvitation(folderId: string): Observable<any> {
    return this.http.post(
      `https://weavadev1.azurewebsites.net/collaboration/folders/${folderId}/invite/accept`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  declineInvitation(folderId: string): Observable<any> {
    return this.deleteFolder(folderId);
  }

  getInvitations(): Observable<any> {
    return this.http.get<any>('https://weavadev1.azurewebsites.net/collaboration/folders/invite', {
      headers: this.getAuthHeaders()
    });
  }

  triggerFolderRefresh(): void {
    this.refreshFoldersSubject.next();
  }
}
