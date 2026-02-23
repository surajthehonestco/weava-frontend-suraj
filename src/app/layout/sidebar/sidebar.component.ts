import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { ShareFolderComponent } from '../share-folder/share-folder.component';
import { EditFolderComponent } from '../edit-folder/edit-folder.component';
import { AccountDetailComponent } from '../account-detail/account-detail.component';
import { FolderService } from '../../services/folder.service';
import { SocketService } from '../../services/socket.service';
import { AuthService } from '../../services/auth.service'; // Import AuthService
import { StripeService } from '../../services/stripe.service'; // Import StripeService
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
  imports: [CommonModule, FontAwesomeModule, ReactiveFormsModule]
})
export class SidebarComponent implements OnInit, OnChanges {
  @Input() folders: any[] = [];
  @Input() activeFolderId: string | null = null;
  @Output() folderSelected = new EventEmitter<string>();
  @Output() folderCreated = new EventEmitter<void>();
  createFolderForm: FormGroup;
  expandedFolders: Set<string> = new Set(); // Track expanded folders

  private apiUrl = environment.apiBaseUrl;
  isProfileVisible: boolean = false;
  dimBG: boolean = false;
  userName: string | null = null;
  showSharePanel: boolean = false;
  shareFolderId: string = '';
  shareFolderName: string = '';
  isPremiumActive: boolean = true;
  userId: string | null = null;
  jwtToken: string | null = null;

  // ===== Storage UI state =====
  storage = {
    plan: 'Free',
    quotaBytes: 0,
    usedBytes: 0,
    remainingBytes: 0,
    percentUsed: 0,
    breakdown: { totalSize: 0, pdfSize: 0 }
  };
  // Derived UI fields
  progressPercent = 0;      // e.g., 12.34 (for width:% and aria-valuenow)
  usedHuman = '0 B';        // e.g., "6.69 KB"
  quotaHuman = '0 B';       // e.g., "100 MB"

  constructor(
    private router: Router,
    private http: HttpClient,
    private dialog: MatDialog,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private folderService: FolderService,
    private socketService: SocketService,
    private authService: AuthService,
    private stripeService: StripeService
  ) {
    this.createFolderForm = this.fb.group({ title: ['', Validators.required] });
  }

  ngOnInit() {
    this.loadUserData();
    this.fetchStorageUsage();
    this.checkSubscriptionStatus();

    this.socketService.subscribeToChannel('folderListUpdated', () => {
      this.refreshFolders();
    });

    this.socketService.subscribeToChannel('storageUpdated', () => {
      this.fetchStorageUsage();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeFolderId'] || changes['folders']) {
      this.expandPathToActiveFolder();
    }
  }

  // ====== Storage usage ======
  private getAuthHeaders(): HttpHeaders {
    const user = localStorage.getItem('user');
    if (!user) return new HttpHeaders();
    const parsed = JSON.parse(user);
    return new HttpHeaders().set('Authorization', `Bearer ${parsed.authToken}`);
  }

  fetchStorageUsage(): void {
    const headers = this.getAuthHeaders();
    this.http.get<any>(`${this.apiUrl}/storage/usage`, { headers })
      .subscribe({
        next: (resp) => {
          // Expecting:
          // { plan, quotaBytes, usedBytes, remainingBytes, percentUsed, breakdown: { totalSize, pdfSize } }
          this.storage = {
            plan: resp?.plan ?? 'Free',
            quotaBytes: resp?.quotaBytes ?? 0,
            usedBytes: resp?.usedBytes ?? 0,
            remainingBytes: resp?.remainingBytes ?? 0,
            percentUsed: resp?.percentUsed ?? 0,
            breakdown: {
              totalSize: resp?.breakdown?.totalSize ?? 0,
              pdfSize: resp?.breakdown?.pdfSize ?? 0
            }
          };

          const pct = (this.storage.percentUsed || 0) * 100;
          this.progressPercent = Math.min(Math.max(pct, 0), 100);

          this.usedHuman = this.formatBytes(this.storage.usedBytes);
          this.quotaHuman = this.formatBytes(this.storage.quotaBytes);
        },
        error: (err) => {
          console.error('❌ Error fetching storage usage:', err);
          this.storage = {
            plan: 'Free',
            quotaBytes: 0,
            usedBytes: 0,
            remainingBytes: 0,
            percentUsed: 0,
            breakdown: { totalSize: 0, pdfSize: 0 }
          };
          this.progressPercent = 0;
          this.usedHuman = '0 B';
          this.quotaHuman = '0 B';

          // Optionally, you can show a user-friendly message here
          this.snackBar.open('Failed to fetch storage usage.', 'Close', { duration: 3000 });
        }
      });
  }

  private formatBytes(bytes: number): string {
    if (!bytes || bytes < 0) bytes = 0;
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let val = bytes;
    while (val >= 1024 && i < units.length - 1) {
      val /= 1024;
      i++;
    }
    // 2 decimal places for KB+, no decimals for bytes
    const fixed = i === 0 ? val.toString() : val.toFixed(2);
    return `${fixed} ${units[i]}`;
  }

  // ===== Existing code (unchanged) =====
  loadUserData() {
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const parsedUser = JSON.parse(user);
        this.userName = parsedUser.displayName || 'Guest';
        this.userId = parsedUser.uid; // Load userId
        this.jwtToken = parsedUser.authToken; // Load jwtToken
      } catch (error) {
        console.error('Error parsing user data from localStorage:', error);
        this.userName = 'Guest';
      }
    } else {
      this.userName = 'Guest';
    }
  }

  refreshFolders() {
    const user = localStorage.getItem('user');
    if (!user) return console.error('User not found in localStorage');

    const parsedUser = JSON.parse(user);
    const headers = new HttpHeaders().set('Authorization', `Bearer ${parsedUser.authToken}`);

    this.http.get<any>('https://weavadev1.azurewebsites.net/folders', { headers }).subscribe(
      (response) => {
        if (response.statusCode === 200 && response.folderList.length > 0) {
          this.folders = response.folderList;
          this.expandPathToActiveFolder();
          console.log('✅ Folders refreshed:', this.folders);
        } else {
          console.error('🚨 Unexpected API response:', response);
        }
      },
      error => console.error('❌ Error fetching folders:', error)
    );
  }

  setFolder(folderId: string, event?: Event) {
    if (event) event.stopPropagation();
    if (this.activeFolderId === folderId) return;

    this.activeFolderId = folderId;
    this.folderSelected.emit(folderId);
  }

  createFolder() {
    if (this.createFolderForm.invalid) return;
    const user = localStorage.getItem('user');
    if (!user) return console.error('User not found in localStorage');

    const parsedUser = JSON.parse(user);
    const headers = new HttpHeaders().set('Authorization', `Bearer ${parsedUser.authToken}`);
    const folderData = { title: this.createFolderForm.value.title };

    this.http.post('https://weavadev1.azurewebsites.net/folders/root', folderData, { headers }).subscribe(
      () => {
        this.createFolderForm.reset({ title: '' });
        this.folderCreated.emit();
        this.socketService.emitEvent('folderListUpdated', 'folder created');
        this.showToast('Folder created successfully', 'success');
      },
      error => console.error('❌ Error creating folder:', error)
    );
  }

  deleteFolder(folderId: string, folderName: string) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: { folderName: folderName }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.deleteFolderApiCall(folderId);
      } else {
        console.log('Folder deletion cancelled');
      }
    });
  }

  createSubFolder(parentFolderId: string) {
    if (!parentFolderId) {
      console.error('Parent folder ID is required');
      return;
    }

    const user = localStorage.getItem('user');
    if (!user) {
      console.error('User not found in localStorage');
      return;
    }

    const parsedUser = JSON.parse(user);
    const headers = new HttpHeaders().set('Authorization', `Bearer ${parsedUser.authToken}`);
    const newFolderData = { title: 'New Sub Folder' };

    this.http.post(
      `${this.apiUrl}/folders/${parentFolderId}`,
      newFolderData,
      { headers }
    ).subscribe({
      next: (response) => {
        console.log('Subfolder created successfully', response);
        this.showToast('Subfolder created successfully', 'success');
        this.socketService.emitEvent('folderListUpdated', 'Sub-folder created');
      },
      error: (error) => {
        console.error('Error creating subfolder:', error);
        const message = error?.error?.metadata?.error?.message || 'Failed to create subfolder';
        this.showToast(message, 'error');
      }
    });
  }

  deleteFolderApiCall(folderId: string) {
    const user = localStorage.getItem('user');
    if (!user) return console.error('User not found in localStorage');

    const parsedUser = JSON.parse(user);
    const headers = new HttpHeaders().set('Authorization', `Bearer ${parsedUser.authToken}`);

    this.http.delete(`${this.apiUrl}/folders/${folderId}`, { headers }).subscribe(
      () => {
        this.showToast('Folder deleted successfully', 'success');
        this.socketService.emitEvent('folderListUpdated', 'folder deleted');

        if (this.activeFolderId === folderId) {
          if (this.folders.length > 0) {
            this.activeFolderId = this.folders[0].folderId;
          } else {
            this.router.navigate(['/']);
          }
        }
      },
      (error) => {
        console.error('❌ Error deleting folder:', error);
        this.showToast('Error deleting folder', 'error');
      }
    );
  }

  openShareModal(folderId: string, folderName: string): void {
    const dialogRef = this.dialog.open(ShareFolderComponent, {
      width: '600px',
      data: { folderId: folderId, folderName: folderName }
    });

    dialogRef.afterClosed().subscribe(() => {
      console.log('Modal closed');
    });
  }

  openEditModal(folderId: string, folderName: string): void {
    const dialogRef = this.dialog.open(EditFolderComponent, {
      width: '300px',
      data: { folderId: folderId, folderName: folderName }
    });

    dialogRef.afterClosed().subscribe(() => {
      console.log('Modal closed');
    });
  }

  accountDetail() {
    this.isProfileVisible = !this.isProfileVisible;
    this.dimBG = !this.dimBG;

    const dialogRef = this.dialog.open(AccountDetailComponent, {
      width: '600px',
      data: { folderId: 'hii' }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.refreshFolders();
      } else {
        console.log('Modal closed');
      }
    });
  }

  openChromeShortcuts(): void {
    window.location.href = 'chrome://extensions/shortcuts';
  }

  redirectToSubscription() {
    window.location.href = '/subscription';
  }

  showToast(message: string, type: 'success' | 'error') {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: type === 'success' ? 'success-toast' : 'error-toast'
    });
  }

  toggleProfile() {
    this.isProfileVisible = !this.isProfileVisible;
    this.dimBG = !this.dimBG;
  }

  // signout() {
  //   localStorage.removeItem('user');
  //   this.activeFolderId = null;
  //   this.router.navigate(['/login']);
  // }

  signout() {
    // Call the clearAuth method to clear data from both localStorage and cookies
    this.authService.clearAuth();
    this.activeFolderId = null;

    // Redirect to login page
    this.router.navigate(['/login']);
  }

  toggleFolder(folderId: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    console.log('Toggle folder called for:', folderId, 'Currently expanded:', this.expandedFolders.has(folderId));
    if (this.expandedFolders.has(folderId)) {
      this.expandedFolders.delete(folderId);
    } else {
      this.expandedFolders.add(folderId);
    }
    console.log('After toggle, expanded:', this.expandedFolders.has(folderId));
  }

  isFolderExpanded(folderId: string): boolean {
    return this.expandedFolders.has(folderId);
  }

  private expandPathToActiveFolder(): void {
    if (!this.activeFolderId || !Array.isArray(this.folders) || this.folders.length === 0) return;

    const parentPath = this.findParentPath(this.folders, this.activeFolderId, []);
    if (!parentPath) return;

    parentPath.forEach((folderId) => this.expandedFolders.add(folderId));
  }

  private findParentPath(nodes: any[], targetFolderId: string, ancestors: string[]): string[] | null {
    for (const node of nodes) {
      if (!node || !node.folderId) continue;

      if (node.folderId === targetFolderId) {
        return ancestors;
      }

      const children = Array.isArray(node.subfolders) ? node.subfolders : [];
      if (children.length > 0) {
        const found = this.findParentPath(children, targetFolderId, [...ancestors, node.folderId]);
        if (found) return found;
      }
    }

    return null;
  }

  checkSubscriptionStatus() {
    if (!this.userId || !this.jwtToken) {
      console.error("❌ Missing userId or jwtToken");
      this.isPremiumActive = false; // Default to non-premium
      return;
    }

    this.stripeService.checkSubscriptionStatus(this.userId).subscribe({
      next: (res) => {
        this.isPremiumActive = res.active; // Update premium status
      },
      error: (err) => {
        console.error("❌ Error checking subscription status:", err);
        this.isPremiumActive = false; // Default to non-premium if error occurs
      }
    });
  }

}
