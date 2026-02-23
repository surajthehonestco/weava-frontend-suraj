import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar'; // ✅ Add this
import { SocketService } from '../../services/socket.service';

@Component({
  selector: 'app-share-folder',
  standalone: true,
  templateUrl: './share-folder.component.html',
  styleUrls: ['./share-folder.component.css'],
  imports: [CommonModule, FormsModule] // ✅ FormsModule added here
})
export class ShareFolderComponent {
  inviteEmail: string = '';
  invitations: any[] = []; // This will hold the invited people
  acceptedInvites: any[] = []; // This will hold the accepted invited people

  constructor(
    public dialogRef: MatDialogRef<ShareFolderComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { folderId: string, folderName: string },
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private socketService: SocketService
  ) {}

  ngOnInit() {
    this.fetchInvitations(); // Fetch invitations when the component initializes
    this.fetchAcceptedInvites();

    this.socketService.subscribeToChannel('notificationUpdated', (data: any) => {
      this.fetchInvitations();
      this.fetchAcceptedInvites();
    });
  }

  fetchInvitations() {
    const user = localStorage.getItem('user');
    if (!user) {
      this.showToast('User not logged in', 'error');
      return;
    }
  
    const parsedUser = JSON.parse(user);
    const headers = new HttpHeaders().set('Authorization', `Bearer ${parsedUser.authToken}`);
  
    this.http.get<any>(`https://weavadev1.azurewebsites.net/collaboration/folders/${this.data.folderId}/invite`, { headers })
      .subscribe({
        next: (response: any) => {
          console.log('✅ Invitations fetched:', response);
          this.invitations = response.invited || []; // Store the list of invited people
        },
        error: (err) => {
          console.error('❌ Error fetching invitations:', err);
          this.showToast('Failed to fetch invitations.', 'error');
        }
      });
  }

  fetchAcceptedInvites() {
    const user = localStorage.getItem('user');
    if (!user) {
      this.showToast('User not logged in', 'error');
      return;
    }
  
    const parsedUser = JSON.parse(user);
    const headers = new HttpHeaders().set('Authorization', `Bearer ${parsedUser.authToken}`);
  
    this.http.get<any>(`https://weavadev1.azurewebsites.net/collaboration/folders/${this.data.folderId}/accept`, { headers })
      .subscribe({
        next: (response: any) => {
          console.log('✅ Accepted Invites fetched:', response);
          this.acceptedInvites = response.acceptedUsers || []; // Store the list of accepted invited people
        },
        error: (err) => {
          console.error('❌ Error fetching invitations:', err);
          this.showToast('Failed to fetch invitations.', 'error');
        }
      });
  }

  inviteUser() {
    const user = localStorage.getItem('user');
    if (!user) {
      this.showToast('User not logged in', 'error');
      return;
    }
  
    const parsedUser = JSON.parse(user);
  
    const payload = {
      email: this.inviteEmail,
      collectionTitle: this.data.folderName,
      senderDisplayName: this.inviteEmail || 'Unknown',
      environment: 'Production'
    };
  
    const headers = new HttpHeaders().set('Authorization', `Bearer ${parsedUser.authToken}`);
  
    this.http.post(`https://weavadev1.azurewebsites.net/collaboration/folders/${this.data.folderId}/invite`, payload, { headers })
      .subscribe({
        next: (response: any) => {
          console.log('✅ Response:', response);
          this.showToast('Invitation sent successfully!', 'success');
          this.inviteEmail = '';
          this.socketService.emitEvent('notificationUpdated', 'User Invited');
        },
        error: (err) => {
          console.error('❌ Error inviting user:', err);
          this.showToast('Failed to send invitation.', 'error');
        }
      });
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  getRandomColor(invite: any): string {
    if (!invite._color) {
      const colors = ['#007bff', '#28a745', '#dc3545', '#17a2b8', '#6f42c1', '#fd7e14', '#20c997'];
      invite._color = colors[Math.floor(Math.random() * colors.length)];
    }
    return invite._color;
  }


  showToast(message: string, type: 'success' | 'error') {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: type === 'success' ? 'success-toast' : 'error-toast'
    });
  }
}
