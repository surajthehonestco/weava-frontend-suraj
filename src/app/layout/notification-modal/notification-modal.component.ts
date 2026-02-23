import { Component, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { SocketService } from '../../services/socket.service';

@Component({
  selector: 'app-notification-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-modal.component.html',
  styleUrls: ['./notification-modal.component.css'],
})
export class NotificationModalComponent implements OnInit {
  activeTab = 0;
  unreadCount = 0;
  activePill = 'read';
  notifications: any[] = [];
  invitations: any[] = [];
  isLoadingAll = false;
  isLoadingInvitations = false;

  constructor(
    public activeModal: NgbActiveModal,
    private http: HttpClient,
    private socketService: SocketService
  ) {}

  ngOnInit() {
    this.setActiveTab(0);

    this.socketService.subscribeToChannel('notificationUpdated', (data: any) => {
      this.fetchNotifications();
      this.fetchInvitations();
    });
  }

  private recalcUnreadCount(): void {
    this.unreadCount = (this.notifications || []).filter(n => n && n.read === false).length;
  }

  setActiveTab(tabIndex: number) {
    this.activeTab = tabIndex;
    if (tabIndex === 0) {
      this.fetchNotifications();
    } else if (tabIndex === 1) {
      this.fetchInvitations();
    }
  }

  filterBy(pill: string) {
    this.activePill = pill;
  }

  private getAuthHeaders(): HttpHeaders {
    const user = localStorage.getItem('user');
    if (!user) {
      console.error('⚠️ User not found in localStorage');
      return new HttpHeaders();
    }

    const parsedUser = JSON.parse(user);
    return new HttpHeaders().set('Authorization', `Bearer ${parsedUser.authToken}`);
  }

  fetchNotifications() {
    this.isLoadingAll = true;
    const headers = this.getAuthHeaders();
  
    this.http.get<any>('https://weavadev1.azurewebsites.net/notification', { headers })
      .subscribe({
        next: (response) => {
          // Normalize & store
          const list = response?.data ?? [];
          // (Optional) ensure read is boolean
          this.notifications = list.map((n: any) => ({ ...n, read: !!n.read }));
          this.recalcUnreadCount();
          this.isLoadingAll = false;
        },
        error: (err) => {
          console.error('❌ Error fetching notifications', err);
          this.notifications = [];
          this.recalcUnreadCount();
          this.isLoadingAll = false;
        }
      });
  }

  fetchInvitations() {
    this.isLoadingInvitations = true;
    const headers = this.getAuthHeaders();
  
    this.http.get<any>('https://weavadev1.azurewebsites.net/collaboration/folders/invite', { headers }).subscribe(
      (response) => {
        console.log('📬 Invitations:', response);
        this.invitations = response || [];
        this.isLoadingInvitations = false;
      },
      (error) => {
        console.error('❌ Error fetching invitations:', error);
        this.invitations = [];
        this.isLoadingInvitations = false;
      }
    );
  }

  acceptInvitation(folderId: string) {
    if (!folderId) return;
    const headers = this.getAuthHeaders();
  
    this.http.post(`https://weavadev1.azurewebsites.net/collaboration/folders/${folderId}/invite/accept`, {}, { headers })
      .subscribe({
        next: () => {
          console.log('✅ Folder invitation accepted:', folderId);
          this.socketService.emitEvent('notificationUpdated', 'Accept Invitation');
        },
        error: (err) => {
          console.error('❌ Error accepting invitation:', err);
        }
      });
  }  

  declineInvitation(folderId: string) {
    if (!folderId) return;
    const headers = this.getAuthHeaders();
  
    this.http.delete(`https://weavadev1.azurewebsites.net/folders/${folderId}`, { headers })
      .subscribe({
        next: () => {
          console.log('✅ Folder declined:', folderId);
          this.socketService.emitEvent('notificationUpdated', 'Decline Invited');
        },
        error: (err) => {
          console.error('❌ Error declining folder:', err);
        }
      });
  }  

  viewNotification(note: any) {
    if (!note?.id) return;
    const headers = this.getAuthHeaders();
  
    this.http.patch(`https://weavadev1.azurewebsites.net/notification/read/${note.id}`, {}, { headers })
      .subscribe({
        next: () => {
          note.read = true;
          this.recalcUnreadCount();
          this.socketService.emitEvent('notificationUpdated', 'Notification Marked as read');
        },
        error: (err) => console.error('❌ Error marking as read:', err)
      });
  }

  unreadNotification(note: any) {
    if (!note?.id) return;
    const headers = this.getAuthHeaders();
  
    this.http.patch(`https://weavadev1.azurewebsites.net/notification/unread/${note.id}`, {}, { headers })
      .subscribe({
        next: () => {
          note.read = false;
          this.recalcUnreadCount();
          this.socketService.emitEvent('notificationUpdated', 'Notification Marked as unread');
        },
        error: (err) => console.error('❌ Error marking as unread:', err)
      });
  }

  deleteNotification(note: any) {
    if (!note?.id) return;
    const headers = this.getAuthHeaders();
    const confirmed = confirm(`Are you sure you want to delete notification "${note.title}"?`);
    if (!confirmed) return;
  
    this.http.delete(`https://weavadev1.azurewebsites.net/notification/${note.id}`, { headers })
      .subscribe({
        next: () => {
          this.notifications = this.notifications.filter(n => n.id !== note.id);
          this.recalcUnreadCount();
          this.socketService.emitEvent('notificationUpdated', 'Notification deleted');
        },
        error: (err) => console.error('❌ Error deleting notification:', err)
      });
  }
}
