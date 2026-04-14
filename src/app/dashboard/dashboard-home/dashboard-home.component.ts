import { Component, OnInit, AfterViewInit, HostListener } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../layout/header/header.component';
import { SidebarComponent } from '../../layout/sidebar/sidebar.component';
import { FooterComponent } from '../../layout/footer/footer.component';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { AzureBlobService } from '../../services/azure-blob.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfirmDialogComponent } from '../../layout/confirm-dialog/confirm-dialog.component';
import { ShareFolderComponent } from '../../layout/share-folder/share-folder.component';
import { EditFolderComponent } from '../../layout/edit-folder/edit-folder.component';
import { MatDialog } from '@angular/material/dialog';
import { SocketService } from '../../services/socket.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { ViewChild, ElementRef } from '@angular/core';
import { environment } from '../../../environments/environment';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

interface PdfHighlightRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PdfAnnotationPayload {
  id?: string;
  folder_id: string;
  websiteId: string | null;
  quote: string;
  highlight_color: string;
  note: string;
  selection_range: {
    start_xpath: string;
    start_offset: number;
    end_xpath: string;
    end_offset: number;
    quote: string;
    page: number;
    rects: PdfHighlightRect[];
  };
  created_at: string;
  updated_at: string;
}

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  templateUrl: './dashboard-home.component.html',
  styleUrls: ['./dashboard-home.component.css'],
  imports: [
    CommonModule,
    FormsModule,
    FooterComponent,
    HeaderComponent,
    SidebarComponent,
    NgxExtendedPdfViewerModule,
    FontAwesomeModule,
    NgbModule
  ]
})
export class DashboardHomeComponent implements OnInit, AfterViewInit {
  private readonly defaultLinkIcon = 'assets/images/svg/pdf-website-icon.svg';

  isSidebarCollapsed: boolean = false;
  folders: any[] = [];
  activeFolderId: string | null = null;
  activeFolderName: string = 'No Folder Selected';
  folderDetails: any = null; // ✅ Store folder details
  selectedTab: string = 'highlights';
  PdfView: boolean = false;
  isWebView: boolean = false;
  alertVisible: boolean = true;
  uploadProgress: any = 0;
  selectedText: string = '';
  pdfUrl: string = '';
  pdfName: string = '';
  webUrl: string = '';
  openedIndex: number | null = null;
  openedUrlIndex: number | null = null;
  safeWebUrl!: SafeResourceUrl;
  searchTerm: string = '';
  private legacyPdfObjectUrl: string | null = null;

COLORS = ['#ffe564', '#a0e3a1', '#ffb3c7', '#a8d8ff', '#ffd59b'];
activeHighlightColor = '';
// 🔹 Website / file context (PDF specific)
websiteId: string | null = null;
currentPdfUrl: string | null = null;

lastSelectionRange: Range | null = null;
lastSelectionRect: DOMRect | null = null;

currentPdfPage: number | null = null;
currentTextIndex: { start: number; end: number } | null = null;

activeAnnotationId: string | null = null;

tooltipVisible = false;
tooltipTop = 0;
tooltipLeft = 0;

annotationEditorVisible = false;
annotationText = '';
editorTop = 0;
editorLeft = 0;

hoverTooltipVisible = false;
hoverTooltipText = '';
hoverTooltipTop = 0;
  hoverTooltipLeft = 0;
  pendingAnnotationFocus: { annotationId?: string; page?: number; rect?: PdfHighlightRect } | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private azureBlobService: AzureBlobService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private socketService: SocketService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      const folderId = params['folder'] || null;
      this.activeFolderId = folderId;
      this.updateActiveFolderName();
    });

    this.fetchFolders();

    this.socketService.subscribeToChannel('folderListUpdated', (data: any) => {
      console.log('📂 folderListUpdated event received:', data);
      this.fetchFolders();
      if (this.activeFolderId) {
        this.fetchFolderDetails(this.activeFolderId);
      }
    }); 
  }

  toggleAccordion(index: number) {
    this.openedIndex = this.openedIndex === index ? null : index;
  }

  toggleUrlAccordion(index: number) {
    this.openedUrlIndex = this.openedUrlIndex === index ? null : index;
  }

  openPdfAtAnnotation(file: any, ann: any, event?: MouseEvent): void {
    if (event) {
      const target = event.target as HTMLElement;
      if (target?.closest('button')) return;
    }

    if (!file?.url || !ann?.selection_range?.page) return;

    this.pendingAnnotationFocus = {
      annotationId: ann.id,
      page: ann.selection_range.page,
      rect: ann.selection_range?.rects?.[0]
    };

    this.showPdfView(file, file.fileName || 'PDF');
    this.focusPendingAnnotation();
  }

  private focusPendingAnnotation(attempt = 0): void {
    if (!this.pendingAnnotationFocus) return;
    if (attempt > 30) {
      this.pendingAnnotationFocus = null;
      return;
    }

    const page = this.pendingAnnotationFocus.page;
    if (!page) return;

    const pageEl = document.querySelector(`.page[data-page-number="${page}"]`) as HTMLElement | null;
    const viewerContainer = document.getElementById('viewerContainer') as HTMLElement | null;

    if (!pageEl || !viewerContainer) {
      setTimeout(() => this.focusPendingAnnotation(attempt + 1), 120);
      return;
    }

    const rect = this.pendingAnnotationFocus.rect;
    let yOffsetInPage = 0;
    if (rect) {
      const normalized = rect.y <= 1 && rect.h <= 1;
      yOffsetInPage = normalized ? rect.y * pageEl.clientHeight : rect.y;
    }

    const targetTop = Math.max(pageEl.offsetTop + yOffsetInPage - 120, 0);
    viewerContainer.scrollTo({ top: targetTop, behavior: 'smooth' });

    if (this.pendingAnnotationFocus.annotationId) {
      const mark = document.querySelector(
        `.weava-mark[data-weava-id="${this.pendingAnnotationFocus.annotationId}"]`
      ) as HTMLElement | null;
      if (mark) {
        mark.style.outline = '2px solid #ffb703';
        setTimeout(() => {
          mark.style.outline = '';
        }, 1200);
      }
    }

    this.pendingAnnotationFocus = null;
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  onSearchChange(term: string): void {
    this.searchTerm = (term || '').trim().toLowerCase();
    this.openedIndex = null;
    this.openedUrlIndex = null;
  }

  get filteredSubfolders(): any[] {
    const subfolders = this.folderDetails?.subfolders || [];
    if (!this.searchTerm) return subfolders;

    return subfolders.filter((subFolder: any) =>
      this.matchesSearch([
        subFolder?.title,
        subFolder?.folderName
      ])
    );
  }

  get filteredFiles(): any[] {
    const files = this.folderDetails?.websiteIds || [];
    if (!this.searchTerm) return files;

    return files.filter((file: any) =>
      this.matchesSearch([
        file?.fileName,
        file?.title,
        file?.url,
        ...(file?.annotations || []).flatMap((ann: any) => [ann?.note, ann?.quote])
      ])
    );
  }

  get filteredUrls(): any[] {
    const urls = this.folderDetails?.urls || [];
    if (!this.searchTerm) return urls;

    return urls.filter((link: any) =>
      this.matchesSearch([
        link?.title,
        link?.url,
        ...(link?.annotations || []).flatMap((ann: any) => [ann?.note, ann?.quote])
      ])
    );
  }

  get hasFilteredResults(): boolean {
    return (
      this.filteredSubfolders.length > 0 ||
      this.filteredFiles.length > 0 ||
      this.filteredUrls.length > 0
    );
  }

  private matchesSearch(values: any[]): boolean {
    return values.some((value) =>
      String(value || '').toLowerCase().includes(this.searchTerm)
    );
  }

  openShareModal(folderId: string, folderName: string): void {
    const dialogRef = this.dialog.open(ShareFolderComponent, {
      width: '600px',
      data: { folderId: folderId, folderName: folderName } // Pass the folder name to the dialog
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // Proceed with folder deletion if user confirms
        // this.deleteFolderApiCall(folderId);
      } else {
        // User cancelled the deletion, do nothing
        console.log('Modal closed');
      }
    });
  }

  openEditModal(folderId: string, folderName: string): void {
    const dialogRef = this.dialog.open(EditFolderComponent, {
      width: '300px',
      data: { folderId, folderName }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && this.activeFolderId) {
        this.fetchFolderDetails(this.activeFolderId);
      }
    });
  }

  createSubFolder(parentFolderId: string): void {
    if (!parentFolderId) {
      console.error('Parent folder ID is required');
      return;
    }

    const headers = this.getAuthHeaders();
    if (!headers) return;

    const newFolderData = { title: 'New Sub Folder' };

    this.http.post(
      `https://weavadev1.azurewebsites.net/folders/${parentFolderId}`,
      newFolderData,
      { headers }
    ).subscribe({
      next: () => {
        this.snackBar.open('Subfolder created successfully', 'Close', { duration: 3000 });
        this.socketService.emitEvent('folderListUpdated', 'Sub-folder created');
        if (this.activeFolderId) {
          this.fetchFolderDetails(this.activeFolderId);
        }
      },
      error: (error) => {
        console.error('Error creating subfolder:', error);
        const message = error?.error?.metadata?.error?.message || 'Failed to create subfolder';
        this.snackBar.open(message, 'Close', { duration: 3000 });
      }
    });
  }

  // Function to delete the folder
  deleteFolder(folderId: string, folderName: string) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: { folderName: folderName }  // Pass folder name to dialog for confirmation
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (result) {
        // Proceed with folder deletion
        this.deleteFolderApiCall(folderId);
      } else {
        // User cancelled, do nothing
        console.log('Folder deletion cancelled');
      }
    });
  }

  // Function to call the delete API
  deleteFolderApiCall(folderId: string) {
    const headers = this.getAuthHeaders();
    if (!headers) return;

    // API request to delete the folder
    this.http.delete(`https://weavadev1.azurewebsites.net/folders/${folderId}`, { headers }).subscribe(
      (response) => {
        this.snackBar.open('Folder deleted successfully!', 'Close', { duration: 3000 });
        // After deletion, refresh both the folder list (sidebar) and folder details
        this.socketService.emitEvent('folderListUpdated', 'Folder deleted');
        this.fetchFolderDetails(this.activeFolderId); // Refresh the folder details after deletion
      },
      (error) => {
        console.error('Error deleting folder:', error);
        this.snackBar.open('Failed to delete folder.', 'Close', { duration: 3000 });
      }
    );
  }

  // Function to get Auth Headers
  private getAuthHeaders(): HttpHeaders | null {
    const user = localStorage.getItem('user');
    if (!user) {
      this.snackBar.open('User not logged in', 'Close', { duration: 3000 });
      return null;
    }
    const parsedUser = JSON.parse(user);
    return new HttpHeaders().set('Authorization', `Bearer ${parsedUser.authToken}`);
  }

  // Function to delete a file
  confirmDeleteFile(folderId: string, websiteId: string, fileName: string) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        folderName: fileName,
        title: 'Delete File',
        message: `Are you sure you want to delete the file "${fileName}"?`,
        confirmLabel: 'Delete',
        emitFolderListUpdated: false
      }
    });

    dialogRef.afterClosed().subscribe((result: boolean) => {
      if (result) {
        this.deleteFile(folderId, websiteId);
      }
    });
  }

  confirmDeleteUrl(folderId: string, websiteId: string, title: string) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        folderName: title,
        title: 'Delete URL',
        message: `Are you sure you want to delete the URL "${title}"?`,
        confirmLabel: 'Delete',
        emitFolderListUpdated: false
      }
    });

    dialogRef.afterClosed().subscribe((result: boolean) => {
      if (result) {
        this.deleteFile(folderId, websiteId);
      }
    });
  }

  // Function to delete a file
  deleteFile(folderId: string, websiteId: string) {
    const deleteData = {
      folderId: folderId,
      websiteId: websiteId,
      isHosted: true
    };

    console.log(deleteData);

    const headers = this.getAuthHeaders();
    if (!headers) return;

    this.http.delete('https://weavadev1.azurewebsites.net/files/pdf', { 
      headers, 
      body: deleteData 
    }).subscribe({
      next: (response) => {
        this.snackBar.open('File deleted successfully!', 'Close', { duration: 3000 }); // ✅ Using snackBar for success
        console.log('File deleted successfully:', response);
        this.socketService.emitEvent('storageUpdated', {
          folderId,
          websiteId,
          action: 'delete-file'
        });
        this.fetchFolderDetails(folderId);  // Refresh folder details after deletion
      },
      error: (err) => {
        console.error('Error deleting file:', err);
        this.snackBar.open('Failed to delete file.', 'Close', { duration: 3000 }); // ✅ Using snackBar for error
      }
    });
  }

  switchTab(tab: string) {
    this.selectedTab = tab;
  }

  async showPdfView(fileOrUrl: any, fileName: string): Promise<void> {
    this.removeTextSelectionListener(); // safety

    this.PdfView = true;
    this.isWebView = false;

    const viewerSource = this.getPdfViewerSource(fileOrUrl);
    const resolvedUrl = this.resolvePdfUrl(viewerSource);
    this.pdfUrl = await this.preparePdfViewerUrl(resolvedUrl);
    this.pdfName = fileName;

    this.currentPdfUrl = this.getPdfIdentitySource(fileOrUrl, resolvedUrl);
    this.setWebsiteIdForCurrentPdf();
  }

  private getPdfViewerSource(fileOrUrl: any): string {
    if (typeof fileOrUrl === 'string') {
      return fileOrUrl;
    }

    return (
      fileOrUrl?.signedUrl ||
      fileOrUrl?.signedURL ||
      fileOrUrl?.url ||
      fileOrUrl?.websiteUrl ||
      ''
    );
  }

  private getPdfIdentitySource(fileOrUrl: any, fallbackUrl: string): string {
    if (typeof fileOrUrl === 'string') {
      return fallbackUrl;
    }

    return (
      fileOrUrl?.url ||
      fileOrUrl?.websiteUrl ||
      fileOrUrl?.signedUrl ||
      fileOrUrl?.signedURL ||
      fallbackUrl
    );
  }

  private resolvePdfUrl(url: string): string {
    const value = (url || '').trim();
    if (!value) return '';

    const authToken = this.authService.getToken();

    if (/^https?:\/\//i.test(value)) {
      return this.appendLegacyPdfToken(value, authToken);
    }

    if (value.startsWith('//')) {
      return this.appendLegacyPdfToken(`https:${value}`, authToken);
    }

    return this.appendLegacyPdfToken(`https://${value}`, authToken);
  }

  private async preparePdfViewerUrl(url: string): Promise<string> {
    this.releaseLegacyPdfObjectUrl();

    if (!this.isLegacyPdfStorageUrl(url)) {
      return url;
    }

    const proxyUrl = this.getLegacyPdfProxyUrl(url);
    if (proxyUrl) {
      const proxyBlobUrl = await this.fetchPdfAsObjectUrl(proxyUrl);
      if (proxyBlobUrl) {
        return proxyBlobUrl;
      }
    }

    const s3BlobUrl = await this.fetchLegacyPdfFromS3AsObjectUrl(url);
    return s3BlobUrl || proxyUrl || url;
  }

  private isLegacyPdfStorageUrl(url: string): boolean {
    return /https:\/\/www\.weavatools\.com\/apis\/pdfstorage\//i.test(url);
  }

  private getLegacyPdfProxyUrl(url: string): string {
    const proxyBaseUrl = (environment as any).legacyPdfProxyUrl || '';
    if (!proxyBaseUrl || !this.isLegacyPdfStorageUrl(url)) {
      return '';
    }

    return `${proxyBaseUrl}/legacy-pdf?source=${encodeURIComponent(url)}`;
  }

  private async fetchPdfAsObjectUrl(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store'
      });

      if (!response.ok) {
        console.error('Legacy PDF proxy request failed:', response.status, response.statusText);
        return '';
      }

      const pdfBlob = await response.blob();
      if (!pdfBlob.size) {
        console.error('Legacy PDF proxy returned an empty blob.');
        return '';
      }

      this.legacyPdfObjectUrl = URL.createObjectURL(pdfBlob);
      return this.legacyPdfObjectUrl;
    } catch (error) {
      console.error('Legacy PDF proxy fetch failed:', error);
      return '';
    }
  }

  private async fetchLegacyPdfFromS3AsObjectUrl(sourceUrl: string): Promise<string> {
    const awsConfig = {
      accessKeyId: (environment as any).accessKey || '',
      secretAccessKey: (environment as any).secretKey || '',
      bucketName: (environment as any).bucketName || '',
      region: (environment as any).region || ''
    };

    if (!awsConfig.accessKeyId || !awsConfig.secretAccessKey || !awsConfig.bucketName || !awsConfig.region) {
      console.error('Legacy PDF S3 config missing in environment.');
      return '';
    }

    const legacyId = this.getLegacyPdfStorageId(sourceUrl);
    const candidateKeys = this.buildLegacyPdfCandidateKeys(legacyId);
    if (!candidateKeys.length) {
      console.error('Legacy PDF ID could not be resolved from URL:', sourceUrl);
      return '';
    }

    const s3Client = new S3Client({
      region: awsConfig.region,
      credentials: {
        accessKeyId: awsConfig.accessKeyId,
        secretAccessKey: awsConfig.secretAccessKey
      }
    });

    for (const key of candidateKeys) {
      try {
        const response = await s3Client.send(
          new GetObjectCommand({
            Bucket: awsConfig.bucketName,
            Key: key
          })
        );

        const body = response.Body as any;
        if (!body?.transformToByteArray) {
          console.error('Legacy PDF S3 body is not readable for key:', key);
          continue;
        }

        const bytes = await body.transformToByteArray();
        if (!bytes?.length) {
          console.error('Legacy PDF S3 returned empty bytes for key:', key);
          continue;
        }

        const pdfBlob = new Blob([bytes], {
          type: response.ContentType || 'application/pdf'
        });

        this.legacyPdfObjectUrl = URL.createObjectURL(pdfBlob);
        return this.legacyPdfObjectUrl;
      } catch (error) {
        console.error(`Legacy PDF S3 fetch failed for key: ${key}`, error);
      }
    }

    return '';
  }

  private getLegacyPdfStorageId(sourceUrl: string): string {
    try {
      const parsed = new URL(sourceUrl);
      const segments = parsed.pathname.split('/').filter(Boolean);
      return segments[segments.length - 1] || '';
    } catch {
      return '';
    }
  }

  private buildLegacyPdfCandidateKeys(legacyId: string): string[] {
    if (!legacyId) {
      return [];
    }

    return [
      `pdf/${legacyId}.pdf`,
      `pdf/${legacyId}`,
      `${legacyId}.pdf`,
      legacyId,
      `pdfstorage/${legacyId}.pdf`,
      `pdfstorage/${legacyId}`
    ];
  }

  private appendLegacyPdfToken(url: string, authToken: string | null): string {
    if (!authToken) {
      return url;
    }

    if (!/https:\/\/www\.weavatools\.com\/apis\/pdfstorage\//i.test(url)) {
      return url;
    }

    if (/[?&]token=/i.test(url)) {
      return url;
    }

    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${encodeURIComponent(authToken)}`;
  }
  private normalizeUrl(u: string): string {
    return (u || '')
      .trim()
      .replace(/^https?:\/\//i, '')   // remove http/https
      .replace(/\/+$/g, '')          // remove trailing slashes
      .toLowerCase();
  }

  setWebsiteIdForCurrentPdf(): void {
    if (!this.folderDetails?.websiteIds?.length || !this.currentPdfUrl) return;
    const current = this.normalizeUrl(this.currentPdfUrl);

    const match = this.folderDetails.websiteIds.find((w: any) => {
      const candidateRaw = w?.url || w?.websiteUrl || w?.link || '';
      const candidate = this.normalizeUrl(candidateRaw);
      return current.includes(candidate) || candidate.includes(current);
    });

    this.websiteId = match?.id || null;
    console.log('🆔 websiteId resolved:', this.websiteId);
  }

  showUrlView(url: string, title?: string) {
    this.PdfView = true;
    this.isWebView = true;

    const finalUrl = url.startsWith('http') ? url : 'https://' + url;
    this.safeWebUrl = this.sanitizer.bypassSecurityTrustResourceUrl(finalUrl);

    this.pdfName = title || finalUrl;

    // 🔑 Resolve websiteId first
    this.setWebsiteIdForCurrentPdf();
  }

  openUrlInNewTab(url: string): void {
    const finalUrl = url.startsWith('http')
      ? url
      : 'https://' + url;

    window.open(finalUrl, '_blank', 'noopener,noreferrer');
  }

  private isBlockedFaviconUrl(url: string): boolean {
    const value = (url || '').trim().toLowerCase();
    return (
      !value ||
      value.startsWith('chrome-extension://') ||
      value.startsWith('about:') ||
      value.startsWith('javascript:')
    );
  }

  private buildIconFallbacks(link: any): string[] {
    const candidates = [
      link?.url
        ? `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(link.url)}`
        : '',
      this.defaultLinkIcon
    ];

    const unique: string[] = [];
    for (const src of candidates) {
      if (!src || this.isBlockedFaviconUrl(src) || unique.includes(src)) continue;
      unique.push(src);
    }
    return unique;
  }

  getWeavaStyleIcon(link: any): string {
    if (!link) return this.defaultLinkIcon;
    if (link.__faviconSrc) return link.__faviconSrc;

    const explicitIcon = (link?.favIconUrl || '').trim();
    const fallbacks = this.buildIconFallbacks(link);

    if (explicitIcon && !this.isBlockedFaviconUrl(explicitIcon)) {
      link.__faviconSrc = explicitIcon;
      link.__faviconFallbacks = [explicitIcon, ...fallbacks];
      link.__faviconFallbackIndex = 1;
      return link.__faviconSrc;
    }

    link.__faviconFallbacks = fallbacks;
    link.__faviconFallbackIndex = 1;
    link.__faviconSrc = fallbacks[0] || this.defaultLinkIcon;
    return link.__faviconSrc;
  }

  onIconError(event: Event, link: any) {
    const img = event.target as HTMLImageElement;
    if (!link) {
      img.onerror = null;
      img.src = this.defaultLinkIcon;
      return;
    }

    const fallbacks: string[] = Array.isArray(link.__faviconFallbacks)
      ? link.__faviconFallbacks
      : this.buildIconFallbacks(link);
    const nextIndex = Number(link.__faviconFallbackIndex || 1);

    if (nextIndex >= fallbacks.length) {
      img.onerror = null;
      link.__faviconSrc = this.defaultLinkIcon;
      img.src = link.__faviconSrc;
      return;
    }

    link.__faviconFallbackIndex = nextIndex + 1;
    link.__faviconSrc = fallbacks[nextIndex];
    img.src = link.__faviconSrc;
  }

  hidePdfView() {
    this.PdfView = false;
    this.isWebView = false;
    this.pdfUrl = '';
    this.webUrl = '';
    this.releaseLegacyPdfObjectUrl();
    this.removeTextSelectionListener();
  }

  private releaseLegacyPdfObjectUrl(): void {
    if (!this.legacyPdfObjectUrl) return;

    URL.revokeObjectURL(this.legacyPdfObjectUrl);
    this.legacyPdfObjectUrl = null;
  }

  deleteUrlAnnotation(link: any, ann: any) {
    const headers = this.getAuthHeaders();
    if (!headers) return;

    const annotationId = ann.id;
    const previousAnnotations = Array.isArray(link.annotations) ? [...link.annotations] : [];

    // Instant UI removal
    link.annotations = previousAnnotations.filter((a: any) => a.id !== annotationId);
    this.removeAnnotationVisuals(annotationId);
    this.removeAnnotationFromLocalStores(annotationId);

    this.http
      .delete(`https://weavadev1.azurewebsites.net/annotations/${annotationId}`, {
        headers
      })
      .subscribe({
        next: () => {
          this.snackBar.open(
            'Highlight deleted successfully',
            'Close',
            { duration: 2500 }
          );
        },
        error: (err) => {
          // Rollback if API fails
          link.annotations = previousAnnotations;
          this.fetchAnnotationsFromApi();
          console.error('❌ Failed to delete annotation:', err);

          this.snackBar.open(
            'Failed to delete highlight',
            'Close',
            { duration: 3000 }
          );
        }
      });
  }

  deleteFileAnnotation(file: any, ann: any) {
    const headers = this.getAuthHeaders();
    if (!headers) return;

    const annotationId = ann.id;
    const previousAnnotations = Array.isArray(file.annotations) ? [...file.annotations] : [];

    // Instant UI removal
    file.annotations = previousAnnotations.filter((a: any) => a.id !== annotationId);
    this.removeAnnotationVisuals(annotationId);
    this.removeAnnotationFromLocalStores(annotationId);

    this.http
      .delete(`https://weavadev1.azurewebsites.net/annotations/${annotationId}`, {
        headers
      })
      .subscribe({
        next: () => {
          this.snackBar.open(
            'Highlight deleted successfully',
            'Close',
            { duration: 2500 }
          );
        },
        error: (err) => {
          // Rollback if API fails
          file.annotations = previousAnnotations;
          this.fetchAnnotationsFromApi();
          console.error('❌ Failed to delete file annotation:', err);

          this.snackBar.open(
            'Failed to delete highlight',
            'Close',
            { duration: 3000 }
          );
        }
      });
  }

  private removeAnnotationVisuals(annotationId: string): void {
    if (!annotationId) return;

    document
      .querySelectorAll(`[data-weava-id="${annotationId}"]`)
      .forEach((el: Element) => el.remove());

    document
      .querySelectorAll(`.weava-overlay[data-id="${annotationId}"]`)
      .forEach((el: Element) => el.remove());
  }

  private removeAnnotationFromLocalStores(annotationId: string): void {
    if (!annotationId) return;

    const removeFromStore = (key: string) => {
      const raw = localStorage.getItem(key) || '[]';
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return;
      const filtered = list.filter((a: any) => a?.id !== annotationId);
      localStorage.setItem(key, JSON.stringify(filtered));
    };

    removeFromStore('pdf-annotations');
    removeFromStore('web-annotations');
  }

  closeAlert() {
    this.alertVisible = false;
  }

  // ✅ Runs after the view is initialized
  ngAfterViewInit(): void {
  }

  ngOnDestroy(): void {
    this.releaseLegacyPdfObjectUrl();
    this.removeTextSelectionListener(); // ✅ Clean up event listener on destroy
  }

  // ✅ Remove Event Listener when closing PDF
removeTextSelectionListener(): void {
  document.removeEventListener('mouseup', this.handlePdfSelection);
}

  // Function to fetch folders
  fetchFolders() {
    const user = this.authService.getUser();
    if (!user || !user.authToken) {
      console.error('No token found, unable to fetch folders.');
      return;
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${user.authToken}`);

    this.http.get<any>('https://weavadev1.azurewebsites.net/folders', { headers }).subscribe(
      (response) => {
        if (response.statusCode === 200 && response.folderList.length > 0) {
          this.folders = response.folderList;

          if (!this.activeFolderId) {
            const firstFolderId = this.folders[0].folderId;
            this.setActiveFolder(firstFolderId, false);
          } else {
            this.updateActiveFolderName();

            if (!this.folderDetails || this.folderDetails.folderId !== this.activeFolderId) {
              this.fetchFolderDetails(this.activeFolderId);
            }
          }
        } else {
          console.error('Unexpected API response:', response);
        }
      },
      (error) => {
        console.error('Error fetching folders:', error);
      }
    );
  }

  // Function to set active folder and update URL
  setActiveFolder(folderId: string | null, isInitialLoad = false) {
    if (!folderId) return;

    this.activeFolderId = folderId;
    this.updateActiveFolderName();
    this.fetchFolderDetails(folderId);

    // Store the active folder ID in a cookie for the extension
    document.cookie = `activeFolderId=${folderId}; path=/; SameSite=Lax;`;

    // Update the URL with the active folder ID
    this.router.navigate([], { queryParams: { folder: folderId }, queryParamsHandling: 'merge' });
  }

  // ✅ Update Active Folder Name
  updateActiveFolderName() {
    let activeFolder = this.folders.find((folder: any) => folder.folderId === this.activeFolderId);

    if (!activeFolder) {
        // If not found in top-level folders, search in subfolders
        for (const folder of this.folders) {
            activeFolder = folder.subfolders?.find((subfolder: any) => subfolder.folderId === this.activeFolderId);
            if (activeFolder) break; // Stop searching if found
        }
    }

    this.activeFolderName = activeFolder ? activeFolder.title : 'No Folder Selected';
}

  // ✅ Fetch Folder Details
  fetchFolderDetails(folderId: string | null) {
    if (!folderId) return;

    const user = this.authService.getUser();
    if (!user?.authToken) return;

    const headers = new HttpHeaders().set(
      'Authorization',
      `Bearer ${user.authToken}`
    );

    this.http
      .get<any>(`https://weavadev1.azurewebsites.net/folders/${folderId}`, { headers })
      .subscribe({
        next: (response) => {
          if (response.statusCode === 200) {
            this.folderDetails = response.folderDetails;

            // ✅ 🔥 THIS WAS MISSING
            this.setWebsiteIdForCurrentPdf();

            console.log('📂 Folder loaded, websiteId set:', this.websiteId);
          }
        },
        error: (err) => {
          console.error('❌ Error fetching folder details:', err);
        }
      });
  }

  // ✅ Function to log uploaded file(s) to console
  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      console.error("🚨 No file selected!");
      return;
    }
  
    if (!this.activeFolderId) {
      console.error("❌ No active folder ID found!");
      return;
    }
  
    const files = Array.from(input.files);
    let uploadedCount = 0;
    const totalFiles = files.length;
    this.uploadProgress = `0/${totalFiles}`;
  
    for (const file of files) {
      console.log("📂 Uploading file:", file.name);
  
      try {
        const isUploaded = await this.azureBlobService.uploadFile(file, this.activeFolderId);
        if (isUploaded) {
          uploadedCount++;
          this.uploadProgress = `${uploadedCount}/${totalFiles}`;
          console.log(`✅ File uploaded successfully: ${file.name}`);
        } else {
          console.error(`❌ File upload failed: ${file.name}`);
        }
  
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`🚨 Error uploading file ${file.name}:`, error);
      }
    }

    this.uploadProgress = `Completed: ${uploadedCount}/${totalFiles}`;
    if (uploadedCount > 0) {
      this.socketService.emitEvent('storageUpdated', {
        folderId: this.activeFolderId,
        uploadedCount,
        totalFiles,
        action: 'upload-pdf'
      });
    }
    // ✅ Hide progress after 2 seconds
    setTimeout(() => {
      this.uploadProgress = '';
    }, 2000);
  
    input.value = '';
    this.fetchFolderDetails(this.activeFolderId);
  }

  goToContributeWeava() {
    this.router.navigate(['/contribute-weava']); // Programmatically navigate to the signup page
  }




// try
// 5️⃣ PDF INIT
onPdfReady(): void {
  document.addEventListener('mouseup', this.handlePdfSelection);

  // 🔑 Ensure correct websiteId for current PDF
  this.setWebsiteIdForCurrentPdf();

  // 🔑 Fetch + render highlights from API
  this.fetchAnnotationsFromApi();
  this.focusPendingAnnotation();
}

// 6️⃣ SELECTION HANDLER  ✅ (this was broken in your code)
handlePdfSelection = (): void => {
  requestAnimationFrame(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      this.tooltipVisible = false;
      return;
    }

    const range = selection.getRangeAt(0);
    const container =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as Element)
        : range.startContainer.parentElement;

    if (!container?.closest('.textLayer')) {
      this.tooltipVisible = false;
      return;
    }

    const rects = Array.from(range.getClientRects());
    if (!rects.length) return;

    const text = selection.toString().trim();
    if (!text) return;

    this.selectedText = text;
    this.lastSelectionRange = range.cloneRange();
    this.lastSelectionRect = rects[0];

    // 🔑 VERY IMPORTANT
    this.setWebsiteIdForCurrentPdf();
    console.log('🆔 websiteId on selection:', this.websiteId);

    this.tooltipTop = rects[0].top + window.scrollY - 48;
    this.tooltipLeft = rects[0].left + window.scrollX + rects[0].width / 2;
    this.tooltipVisible = true;
  });
};

// 7️⃣ APPLY COLOR ✅ (null-safe + payload logging)
applyHighlight(color: string): void {
  const payload = this.buildPdfAnnotationPayload(color);
  if (!payload || !this.websiteId) return;

  payload.websiteId = this.websiteId;

  console.log('📤 Sending annotation payload:', payload);

  // 1️⃣ Save locally
  const id = this.saveToLocal(payload);
  payload.id = id;

  // 1.5️⃣ Optimistic card update (show annotation instantly in list)
  this.addAnnotationToFolderDetails(payload);

  // 2️⃣ Draw highlight
  this.drawExactPdfHighlight(payload);

  // 3️⃣ Save to API
  this.saveAnnotationToApi(payload);

  this.tooltipVisible = false;
  window.getSelection()?.removeAllRanges();
}

private addAnnotationToFolderDetails(payload: PdfAnnotationPayload): void {
  if (!this.folderDetails || !payload.websiteId || !payload.id) return;

  const optimisticAnnotation = {
    id: payload.id,
    websiteId: payload.websiteId,
    quote: payload.quote,
    note: payload.note || '',
    highlightColor: payload.highlight_color,
    color: payload.highlight_color,
    highlight_color: payload.highlight_color,
    created_at: payload.created_at,
    updated_at: payload.updated_at,
    selection_range: payload.selection_range
  };

  const appendToMatchingSource = (items: any[] | undefined) => {
    if (!Array.isArray(items)) return items;

    return items.map((item: any) => {
      if (!item || item.id !== payload.websiteId) return item;

      const existing = Array.isArray(item.annotations) ? item.annotations : [];
      return { ...item, annotations: [optimisticAnnotation, ...existing] };
    });
  };

  this.folderDetails = {
    ...this.folderDetails,
    websiteIds: appendToMatchingSource(this.folderDetails.websiteIds),
    urls: appendToMatchingSource(this.folderDetails.urls)
  };
}

private removeAnnotationFromFolderDetails(annotationId: string): void {
  if (!this.folderDetails || !annotationId) return;

  const removeFromSources = (items: any[] | undefined) => {
    if (!Array.isArray(items)) return items;

    return items.map((item: any) => {
      if (!item || !Array.isArray(item.annotations)) return item;
      return {
        ...item,
        annotations: item.annotations.filter((ann: any) => ann?.id !== annotationId)
      };
    });
  };

  this.folderDetails = {
    ...this.folderDetails,
    websiteIds: removeFromSources(this.folderDetails.websiteIds),
    urls: removeFromSources(this.folderDetails.urls)
  };
}

drawExactPdfHighlight(payload: PdfAnnotationPayload): void {
  if (!payload?.selection_range?.rects?.length || !payload.id) return;

  const pageEl = document.querySelector(
    `.page[data-page-number="${payload.selection_range.page}"]`
  ) as HTMLElement | null;

  if (!pageEl) return;
  const textLayer = pageEl.querySelector('.textLayer') as HTMLElement | null;
  if (!textLayer) return;

  // 🔁 One overlay per annotation
  let overlay = textLayer.querySelector(
    `.weava-overlay[data-id="${payload.id}"]`
  ) as HTMLElement | null;

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'weava-overlay';
    overlay.dataset['id'] = payload.id;
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.pointerEvents = 'none'; // 🔑 overlay never blocks anything
    textLayer.appendChild(overlay);
  }

  const pageRect = pageEl.getBoundingClientRect();
  const textLayerRect = textLayer.getBoundingClientRect();
  const textLayerOffsetX = textLayerRect.left - pageRect.left;
  const textLayerOffsetY = textLayerRect.top - pageRect.top;

  // 🔥 Draw each rect
  payload.selection_range.rects.forEach((rect: PdfHighlightRect) => {
    const mark = document.createElement('div');
    mark.className = 'weava-mark';
    mark.dataset['weavaId'] = payload.id;

    mark.style.position = 'absolute';
    const isNormalized = rect.x <= 1 && rect.y <= 1 && rect.w <= 1 && rect.h <= 1;

    if (isNormalized) {
      mark.style.left = `${rect.x * 100}%`;
      mark.style.top = `${rect.y * 100}%`;
      mark.style.width = `${rect.w * 100}%`;
      mark.style.height = `${rect.h * 100}%`;
    } else {
      // Legacy annotations were saved relative to `.page`, convert to `.textLayer`.
      mark.style.left = `${rect.x - textLayerOffsetX}px`;
      mark.style.top = `${rect.y - textLayerOffsetY}px`;
      mark.style.width = `${rect.w}px`;
      mark.style.height = `${rect.h}px`;
    }

    mark.style.backgroundColor = payload.highlight_color;
    mark.style.opacity = '0.45';

    // ✅ VERY IMPORTANT LINES
    mark.style.pointerEvents = 'auto'; // 🔥 click works
    mark.style.cursor = 'pointer';
    mark.style.userSelect = 'none';    // 🔥 text selection still works below

    overlay.appendChild(mark);
  });
}

// 8️⃣ PAYLOAD BUILDER
buildPdfAnnotationPayload(color: string): PdfAnnotationPayload | null {
  // ❌ No active folder → no annotation
  if (!this.activeFolderId) {
    console.warn('❌ No activeFolderId, annotation aborted');
    return null;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);

  // 🔒 Ensure selection is inside PDF textLayer
  const container =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : range.startContainer.parentElement;

  if (!container || !container.closest('.textLayer')) {
    return null;
  }

  const quote = selection.toString().trim();
  if (!quote) return null;

  const selectionRange = this.buildPdfSelectionRange(range, quote);
  if (!selectionRange) return null;

  const now = new Date().toISOString();

  return {
    folder_id: this.activeFolderId, // ✅ now guaranteed string
    websiteId: this.websiteId,
    quote,
    highlight_color: color,
    note: '',
    selection_range: selectionRange,
    created_at: now,
    updated_at: now
  };
}

// 9️⃣ LOCAL STORAGE
saveToLocal(payload: PdfAnnotationPayload): string {
  const list = JSON.parse(localStorage.getItem('pdf-annotations') || '[]');
  const id = crypto.randomUUID();
  list.push({ ...payload, id });
  localStorage.setItem('pdf-annotations', JSON.stringify(list));
  return id;
}

// 🔟 DRAW HIGHLIGHT (best-effort restore)
drawPdfHighlight(payload: any): void {
  const layer = document.querySelector(
    `.page[data-page-number="${payload.selection_range.page}"] .textLayer`
  ) as HTMLElement | null;

  if (!layer) return;

  const spans = layer.querySelectorAll('span');
  spans.forEach((s) => {
    const t = (s.textContent || '').trim();
    if (!t) return;

    if ((payload.quote || '').includes(t)) {
      (s as HTMLElement).style.backgroundColor = payload.highlight_color;
      (s as HTMLElement).dataset['weavaId'] = payload.id;
      (s as HTMLElement).style.cursor = 'pointer';
    }
  });
}

// 1️⃣1️⃣ CLICK TO EDIT
@HostListener('click', ['$event'])
onHighlightClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  const mark = target.closest('.weava-mark') as HTMLElement | null;
  if (!mark) return;

  const id = mark.dataset['weavaId'];
  if (!id) return;

  this.activeAnnotationId = id;

  const saved = this.getAnnotationFromLocal(id);
  this.annotationText = saved?.note || '';

  const rect = mark.getBoundingClientRect();
  this.editorTop = rect.bottom + window.scrollY + 8;
  this.editorLeft = rect.left + window.scrollX;

  this.annotationEditorVisible = true;
}

@HostListener('mouseover', ['$event'])
onHighlightHover(e: MouseEvent): void {
  const mark = (e.target as HTMLElement).closest('.weava-mark') as HTMLElement | null;
  if (!mark) {
    this.hoverTooltipVisible = false;
    return;
  }

  const id = mark.dataset['weavaId'];
  if (!id) return;

  const annotation = this.getAnnotationFromLocal(id);
  if (!annotation?.note?.trim()) {
    this.hoverTooltipVisible = false;
    return;
  }

  const rect = mark.getBoundingClientRect();

  this.hoverTooltipText = annotation.note;
  this.hoverTooltipTop = rect.top + window.scrollY - 12;
  this.hoverTooltipLeft = rect.left + window.scrollX + rect.width / 2;
  this.hoverTooltipVisible = true;
}

@HostListener('mouseout')
onHighlightOut(): void {
  this.hoverTooltipVisible = false;
}

@HostListener('mouseout', ['$event'])
onHighlightLeave(e: MouseEvent): void {
  const el = e.target as HTMLElement;
  if (!el.classList.contains('weava-mark')) return;

  this.hoverTooltipVisible = false;
}

saveAnnotation(): void {
  if (!this.activeAnnotationId) return;

  const list: PdfAnnotationPayload[] =
    JSON.parse(localStorage.getItem('pdf-annotations') || '[]');

  const item = list.find(a => a.id === this.activeAnnotationId);
  if (!item) return;

  // 1️⃣ Update local
  item.note = this.annotationText;
  item.updated_at = new Date().toISOString();

  localStorage.setItem('pdf-annotations', JSON.stringify(list));
  this.updateAnnotationNoteInFolderDetails(this.activeAnnotationId, item.note, item.updated_at);

  // 2️⃣ Update API
  this.updateAnnotationApi(this.activeAnnotationId, {
    quote: item.quote,
    note: item.note,
    highlight_color: item.highlight_color
  });

  // 3️⃣ UI cleanup
  this.annotationEditorVisible = false;
}

private updateAnnotationNoteInFolderDetails(annotationId: string, note: string, updatedAt: string): void {
  if (!this.folderDetails || !annotationId) return;

  const updateSources = (items: any[] | undefined) => {
    if (!Array.isArray(items)) return items;

    return items.map((item: any) => {
      if (!item || !Array.isArray(item.annotations)) return item;

      const annotations = item.annotations.map((ann: any) => {
        if (!ann || ann.id !== annotationId) return ann;
        return { ...ann, note, updated_at: updatedAt };
      });

      return { ...item, annotations };
    });
  };

  this.folderDetails = {
    ...this.folderDetails,
    websiteIds: updateSources(this.folderDetails.websiteIds),
    urls: updateSources(this.folderDetails.urls)
  };
}

cancelAnnotation(): void {
  this.annotationEditorVisible = false;
  this.annotationText = '';
}

copySelection(): void {
  navigator.clipboard.writeText(this.selectedText);
  this.tooltipVisible = false;
}

// 1️⃣2️⃣ HELPERS
getNoteFromLocal(id: string): string {
  const list = JSON.parse(localStorage.getItem('pdf-annotations') || '[]');
  const item = list.find((x: any) => x.id === id);
  return item?.note || '';
}

getCurrentPdfPage(range: Range): number {
  const startNode = range.startContainer;
  const el =
    startNode.nodeType === Node.ELEMENT_NODE
      ? (startNode as Element)
      : (startNode.parentElement as Element | null);

  const pageEl = el?.closest('.page') as HTMLElement | null;
  const page = pageEl?.getAttribute('data-page-number');
  return page ? Number(page) : 1;
}

getTextIndexInPage(range: Range): { start: number; end: number } {
  const text = range.toString();
  return { start: 0, end: text.length };
}

private getSpansTouchedByRange(range: Range): HTMLElement[] {
  const ancestor = range.commonAncestorContainer;
  const rootEl =
    ancestor.nodeType === Node.ELEMENT_NODE
      ? (ancestor as Element)
      : (ancestor.parentElement as Element | null);

  const textLayer = rootEl?.closest('.textLayer') as HTMLElement | null;
  if (!textLayer) return [];

  const spans = Array.from(textLayer.querySelectorAll('span')) as HTMLElement[];
  const touched: HTMLElement[] = [];

  for (const s of spans) {
    try {
      if (range.intersectsNode(s)) touched.push(s);
    } catch {
      // ignore
    }
  }
  return touched;
}

private getPdfPageElFromNode(node: Node): HTMLElement | null {
  const el = node.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : (node.parentElement as Element | null);

  return (el?.closest('.page') as HTMLElement) || null;
}

private getPageNumberFromPageEl(pageEl: HTMLElement): number {
  const n = pageEl.getAttribute('data-page-number');
  return n ? Number(n) : 1;
}

private getSpanIndex(span: HTMLElement): number {
  const textLayer = span.closest('.textLayer');
  if (!textLayer) return -1;
  const spans = Array.from(textLayer.querySelectorAll('span'));
  return spans.indexOf(span);
}

private getOwningSpan(node: Node): HTMLElement | null {
  const el = node.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : (node.parentElement as Element | null);

  if (!el) return null;
  const span = el.closest('.textLayer span') as HTMLElement | null;
  return span;
}

private buildPdfSelectionRange(range: Range, quote: string) {
  const startSpan = this.getOwningSpan(range.startContainer);
  const endSpan = this.getOwningSpan(range.endContainer);
  if (!startSpan || !endSpan) return null;

  const pageEl = startSpan.closest('.page') as HTMLElement;
  if (!pageEl) return null;
  const textLayer = startSpan.closest('.textLayer') as HTMLElement;
  if (!textLayer) return null;

  const page = Number(pageEl.getAttribute('data-page-number'));

  const textLayerRect = textLayer.getBoundingClientRect();
  if (!textLayerRect.width || !textLayerRect.height) return null;
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

  const rects = Array.from(range.getClientRects())
    .filter(r => r.width > 0 && r.height > 0)
    .map(r => ({
      // Save normalized coordinates relative to textLayer for zoom/layout-safe replay.
      x: clamp01((r.left - textLayerRect.left) / textLayerRect.width),
      y: clamp01((r.top - textLayerRect.top) / textLayerRect.height),
      w: clamp01(r.width / textLayerRect.width),
      h: clamp01(r.height / textLayerRect.height)
    }));

  return {
    start_xpath: `/pdf/page[${page}]/span[${this.getSpanIndex(startSpan) + 1}]`,
    start_offset: range.startOffset,
    end_xpath: `/pdf/page[${page}]/span[${this.getSpanIndex(endSpan) + 1}]`,
    end_offset: range.endOffset,
    quote,
    page,
    rects
  };
}

drawHighlightRects(payload: any) {
  const page = payload.selection_range.page;
  const rects = payload.selection_range.rects || [];
  const pageEl = document.querySelector(`.page[data-page-number="${page}"]`) as HTMLElement | null;
  if (!pageEl) return;

  let overlay = pageEl.querySelector('.weava-rect-overlay') as HTMLElement | null;
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'weava-overlay';
    overlay.dataset['id'] = payload.id!;
    overlay.style.position = 'absolute';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.pointerEvents = 'none'; // ✅
    pageEl.appendChild(overlay);
  }

  rects.forEach((r: any) => {
    const d = document.createElement('div');
    d.style.position = 'absolute';
    d.style.left = `${r.x}px`;
    d.style.top = `${r.y}px`;
    d.style.width = `${r.w}px`;
    d.style.height = `${r.h}px`;
    d.style.background = payload.highlight_color;
    d.style.opacity = '0.45';
    d.style.borderRadius = '3px';
    overlay!.appendChild(d);
  });
}

getAnnotationFromLocal(id: string): PdfAnnotationPayload | null {
  const list: PdfAnnotationPayload[] =
    JSON.parse(localStorage.getItem('pdf-annotations') || '[]');

  return list.find(x => x.id === id) || null;
}

saveAnnotationToApi(payload: PdfAnnotationPayload): void {
  const user = this.authService.getUser();
  const token = user?.authToken;

  if (!token) {
    console.error('❌ No auth token found. Annotation not sent to API.');
    return;
  }

  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  });

  const url = 'https://weavadev1.azurewebsites.net/annotations';

  this.http.post(url, payload, { headers }).subscribe({
    next: (res) => {
      console.log('✅ Annotation saved to API', res);
      if (this.activeFolderId) {
        this.fetchFolderDetails(this.activeFolderId);
      }
    },
    error: (err) => {
      console.error('❌ Annotation API failed', err);
      if (payload.id) {
        this.removeAnnotationFromFolderDetails(payload.id);
      }
    }
  });
}

fetchAnnotationsFromApi(): void {
  if (!this.activeFolderId || !this.websiteId) return;

  const user = this.authService.getUser();
  const token = user?.authToken;
  if (!token) return;

  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`
  });

  const url = `https://weavadev1.azurewebsites.net/annotations/${this.activeFolderId}`;

  this.http.get<any>(url, { headers }).subscribe({
    next: (res) => {
      const all = res?.annotations || [];

      // ✅ Only current PDF annotations
      const pdfAnnotations = all.filter((a: any) =>
        a.websiteId === this.websiteId &&
        a.selection_range?.rects?.length
      );

      // 🔑 IMPORTANT FIX
      // Sync API annotations into localStorage
      localStorage.setItem(
        'pdf-annotations',
        JSON.stringify(pdfAnnotations)
      );

      console.log('📥 PDF annotations synced:', pdfAnnotations);

      this.drawApiPdfAnnotations(pdfAnnotations);
    },
    error: (err) => {
      console.error('❌ Failed to fetch annotations', err);
    }
  });
}

drawApiPdfAnnotations(list: any[]): void {
  // 🔥 Clear old overlays first
  document
    .querySelectorAll('.weava-overlay')
    .forEach(el => el.remove());

  list.forEach(annotation => {
    this.drawExactPdfHighlight(annotation);
  });
}

updateAnnotationApi(
  annotationId: string,
  data: { quote?: string; note?: string; highlight_color?: string }
): void {
  const user = this.authService.getUser();
  const token = user?.authToken;
  if (!token) return;

  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  });

  const url = `https://weavadev1.azurewebsites.net/annotations/${annotationId}`;

  this.http.patch(url, data, { headers }).subscribe({
    next: (res) => {
      console.log('✅ Annotation updated (API)', res);
    },
    error: (err) => {
      console.error('❌ Annotation update failed', err);
    }
  });
}

deleteAnnotationApi(annotationId: string): void {
  const user = this.authService.getUser();
  const token = user?.authToken;
  if (!token) return;

  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`
  });

  const url = `https://weavadev1.azurewebsites.net/annotations/${annotationId}`;

  this.http.delete(url, { headers }).subscribe({
    next: () => {
      console.log('🗑️ Annotation deleted (API)');
    },
    error: (err) => {
      console.error('❌ Delete failed', err);
    }
  });
}

deleteAnnotation(): void {
  if (!this.activeAnnotationId) return;

  // 1️⃣ Remove highlight from PDF
  document
    .querySelectorAll(`[data-weava-id="${this.activeAnnotationId}"]`)
    .forEach((el: Element) => el.remove());

  document
    .querySelectorAll(`.weava-overlay[data-id="${this.activeAnnotationId}"]`)
    .forEach((el: Element) => el.remove());

  // 2️⃣ Read localStorage with EXPLICIT TYPE
  const stored = localStorage.getItem('pdf-annotations') || '[]';

  const annotations: PdfAnnotationPayload[] = JSON.parse(stored);

  // 3️⃣ FILTER with STRONGLY TYPED PARAMETER
  const updatedAnnotations: PdfAnnotationPayload[] =
    annotations.filter(
      (a: PdfAnnotationPayload) => a.id !== this.activeAnnotationId
    );

  // 4️⃣ Save back
  localStorage.setItem(
    'pdf-annotations',
    JSON.stringify(updatedAnnotations)
  );

  // 5️⃣ API DELETE
  this.deleteAnnotationApi(this.activeAnnotationId);

  // 6️⃣ UI cleanup
  this.annotationEditorVisible = false;
  this.activeAnnotationId = null;
  this.annotationText = '';
}

@ViewChild('webIframe')
webIframe!: ElementRef<HTMLIFrameElement>;

onIframeLoaded(): void {
  const iframe = this.webIframe?.nativeElement;
  if (!iframe) return;

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  console.log('🌐 iframe ready, restoring website annotations');

  this.injectWeavaCss(doc);
  this.restoreWebsiteAnnotationsInIframe();
}

injectWeavaCss(doc: Document): void {
  if (doc.getElementById('weava-style')) return;

  const style = doc.createElement('style');
  style.id = 'weava-style';
  style.textContent = `
    .weava-mark {
      background-color: rgba(255,213,155,0.6);
      cursor: pointer;
    }
    .weava-mark:hover {
      outline: 2px solid #ffb703;
    }
  `;
  doc.head.appendChild(style);
}

restoreWebsiteAnnotationsInIframe(): void {
  const iframe = this.webIframe?.nativeElement;
  if (!iframe) return;

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  const list: PdfAnnotationPayload[] = JSON.parse(
    localStorage.getItem('web-annotations') || '[]'
  );

  list.forEach((a: PdfAnnotationPayload) => {
    if (!a.selection_range?.start_xpath) return;

    const node = this.getNodeByXPath(doc, a.selection_range.start_xpath);
    if (!node) return;

    const range = doc.createRange();
    range.setStart(node, a.selection_range.start_offset);
    range.setEnd(node, a.selection_range.end_offset);

    const span = doc.createElement('span') as HTMLElement;
    span.className = 'weava-mark';
    span.style.backgroundColor = a.highlight_color;
    span.textContent = range.toString();

    // 🔑 dataset works ONLY on HTMLElement
    if (a.id) {
      span.dataset['weavaId'] = a.id;
    }

    range.deleteContents();
    range.insertNode(span);
  });
}

injectWeavaListeners(doc: Document): void {
  doc.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const mark = target.closest('.weava-mark') as HTMLElement | null;
    if (!mark) return;

    const id = mark.dataset['weavaId'];
    if (!id) return;

    console.log('✏️ Website annotation clicked:', id);

    this.activeAnnotationId = id;
    this.annotationText = this.getNoteFromLocal(id);
    this.annotationEditorVisible = true;
  });

  doc.addEventListener('mouseover', (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const mark = target.closest('.weava-mark') as HTMLElement | null;
    if (!mark) return;

    const id = mark.dataset['weavaId'];
    if (!id) return;

    const list: PdfAnnotationPayload[] = JSON.parse(
      localStorage.getItem('web-annotations') || '[]'
    );

    const ann = list.find(
      (x: PdfAnnotationPayload) => x.id === id
    );

    if (!ann?.note) return;

    console.log('💬 Website annotation note:', ann.note);
  });
}

injectWeavaLogic(doc: Document): void {
  // 1️⃣ Inject CSS
  const style = doc.createElement('style');
  style.textContent = `
    .weava-mark {
      background: yellow;
      cursor: pointer;
    }
    .weava-tooltip {
      position: fixed;
      z-index: 999999;
    }
  `;
  doc.head.appendChild(style);

  // 2️⃣ Inject selection listener
  doc.addEventListener('mouseup', () => {
    const sel = doc.getSelection();
    if (!sel || sel.isCollapsed) return;

    const range = sel.getRangeAt(0);
    const quote = sel.toString().trim();
    if (!quote) return;

    console.log('🌐 Website text selected:', quote);

    // 🔑 Here you call SAME logic as extension
    // build xpath, offsets, rects
    // show tooltip
  });

  // 3️⃣ Restore annotations from API
  this.restoreWebsiteAnnotations(doc);
}

restoreWebsiteAnnotations(doc: Document): void {
  const list: PdfAnnotationPayload[] = JSON.parse(
    localStorage.getItem('web-annotations') || '[]'
  );

  list.forEach((a: PdfAnnotationPayload) => {
    if (!a.selection_range?.start_xpath) return;

    const node = this.getNodeByXPath(doc, a.selection_range.start_xpath);
    if (!node) return;

    const range = doc.createRange();
    range.setStart(node, a.selection_range.start_offset);
    range.setEnd(node, a.selection_range.end_offset);

    const mark = doc.createElement('span') as HTMLElement;
    mark.className = 'weava-mark';
    mark.style.backgroundColor = a.highlight_color;
    mark.textContent = range.toString();

    if (a.id) {
      mark.dataset['weavaId'] = a.id;
    }

    range.deleteContents();
    range.insertNode(mark);
  });
}

getNodeByXPath(doc: Document, xpath: string): Node | null {
  try {
    const result = doc.evaluate(
      xpath,
      doc,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue;
  } catch {
    return null;
  }
}

fetchWebsiteAnnotations(): void {
  if (!this.activeFolderId || !this.websiteId) return;

  const user = this.authService.getUser();
  if (!user?.authToken) return;

  const headers = new HttpHeaders({
    Authorization: `Bearer ${user.authToken}`
  });

  const url = `https://weavadev1.azurewebsites.net/annotations/${this.activeFolderId}`;

  this.http.get<any>(url, { headers }).subscribe({
    next: res => {
      const all = res?.annotations || [];

      const websiteAnnotations = all.filter((a: any) =>
        a.websiteId === this.websiteId &&
        a.selection_range?.start_xpath
      );

      // 🔑 Save separately
      localStorage.setItem(
        'web-annotations',
        JSON.stringify(websiteAnnotations)
      );

      // Inject into iframe
      this.restoreWebsiteAnnotationsInIframe();
    },
    error: err => console.error('❌ Website annotation fetch failed', err)
  });
}


}


