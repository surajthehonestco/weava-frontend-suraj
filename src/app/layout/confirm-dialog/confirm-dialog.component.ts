import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SocketService } from '../../services/socket.service';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.css']
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    private socketService: SocketService,
    @Inject(MAT_DIALOG_DATA)
    public data: {
      folderName?: string;
      title?: string;
      message?: string;
      confirmLabel?: string;
      emitFolderListUpdated?: boolean;
    }
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true); // Close dialog and pass true for confirmation
    if (this.data.emitFolderListUpdated !== false) {
      this.socketService.emitEvent('folderListUpdated', 'folder deleted');
    }
  }

  onCancel(): void {
    this.dialogRef.close(false); // Close dialog and pass false for cancellation
  }
}
