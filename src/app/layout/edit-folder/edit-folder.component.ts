import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';  // Import FormsModule for ngModel
import { SocketService } from '../../services/socket.service';

@Component({
  selector: 'app-edit-folder',
  standalone: true, // Make this a standalone component
  templateUrl: './edit-folder.component.html',
  styleUrls: ['./edit-folder.component.css'],
  imports: [FormsModule]  // Import FormsModule to use ngModel
})
export class EditFolderComponent implements OnInit {
  folderName: string = '';  // Declare the folderName property for two-way data binding

  constructor(
    public dialogRef: MatDialogRef<EditFolderComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { folderId: string, folderName: string },
    private http: HttpClient,  // Inject HttpClient to make API calls
    private snackBar: MatSnackBar,  // Inject MatSnackBar for notifications
    private socketService: SocketService
  ) {}

  ngOnInit() {
    // Initialize the folderName with the passed data
    this.folderName = this.data.folderName;  // Set the initial folder name value
  }

  saveFolder() {
    if (!this.folderName) return;  // Ensure folder name is entered

    const updatedFolder = { title: this.folderName };
    const headers = this.getAuthHeaders();
    if (!headers) return;

    this.http.patch<any>(  // Use <any> to specify the response type
      `https://weavadev1.azurewebsites.net/folders/${this.data.folderId}`,
      updatedFolder,
      { headers }
    ).subscribe({
      next: (response: any) => {  // Explicit type for response
        this.showToast('Folder updated successfully!', 'success');
        this.socketService.emitEvent('folderListUpdated', { folderId: this.data.folderId }); //socket emitted
        this.dialogRef.close(true);  // Close the dialog on success
      },
      error: (err: any) => {  // Explicit type for error
        this.showToast('Failed to update folder.', 'error');
      }
    });
  }

  showToast(message: string, type: 'success' | 'error') {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: type === 'success' ? 'success-toast' : 'error-toast'
    });
  }

  onCancel() {
    this.dialogRef.close(false);  // Close dialog without saving
  }

  private getAuthHeaders(): HttpHeaders | null {
    const user = localStorage.getItem('user');
    if (!user) {
      this.snackBar.open('User not logged in', 'Close', { duration: 3000 });
      return null;
    }
    const parsedUser = JSON.parse(user);
    return new HttpHeaders().set('Authorization', `Bearer ${parsedUser.authToken}`);
  }
}
