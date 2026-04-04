import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class AzureBlobService {
  private accountName = 'weavadev';
  private containerName = 'pdfs';
  private sasToken = 'sv=2025-01-05&spr=https&se=2025-04-13T21%3A32%3A06Z&sr=b&sp=cw&sig=WFpwmwfMPuRdXW4QDXoIs%2FWJDuzWr9CVv6uiy9DTigQ%3D';
  private backendApiUrl = 'https://weavadev1.azurewebsites.net';

  constructor(private http: HttpClient) {}

  async uploadFile(file: File, folderId: string): Promise<boolean> {
    try {
      const sasToken = await this.getSasToken(file.name);
      if (!sasToken) return false;

      const blobUrl = `https://${this.accountName}.blob.core.windows.net/${this.containerName}/${file.name}?${sasToken}`;

      const response = await fetch(blobUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'x-ms-blob-type': 'BlockBlob',
          'Content-Type': file.type
        }
      });

      if (response.ok) {
        console.log('File uploaded successfully:', file.name);

        const signedUrlResponse = await this.getSignedUrl(file.name, folderId);
        if (signedUrlResponse) {
          await this.setPdf(signedUrlResponse, file.name, folderId, file.size);
        }

        return true;
      }

      console.error('Upload failed:', response.statusText);
      return false;
    } catch (error) {
      console.error('Error uploading file:', error);
      return false;
    }
  }

  private async getSasToken(fileName: string): Promise<string | null> {
    const user = localStorage.getItem('user');
    if (!user) {
      console.error('No user found in localStorage!');
      return null;
    }

    const parsedUser = JSON.parse(user);
    const authToken = parsedUser.authToken;

    if (!authToken) {
      console.error('No authToken found in localStorage!');
      return null;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${authToken}`
    });

    try {
      const response: any = await this.http
        .get(`${this.backendApiUrl}/files/sas-token?fileName=${fileName}`, { headers })
        .toPromise();
      return response?.token || null;
    } catch (error) {
      console.error('Error fetching SAS token:', error);
      return null;
    }
  }

  async getSignedUrl(fileName: string, folderId: string): Promise<any> {
    const url = `${this.backendApiUrl}/files/getSignedUrl`;
    const user = localStorage.getItem('user');
    if (!user) {
      console.error('No user found in localStorage!');
      return null;
    }

    const parsedUser = JSON.parse(user);
    const authToken = parsedUser.authToken;

    if (!authToken) {
      console.error('No authToken found in localStorage!');
      return null;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    });

    const body = {
      fileNameList: [fileName],
      folderId
    };

    try {
      const response = await this.http.post(url, body, { headers }).toPromise();
      console.log('Signed URL response:', response);
      return response;
    } catch (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }
  }

  async setPdf(
    signedUrlResponse: any,
    fileName: string,
    folderId: string,
    fileSize: number
  ): Promise<void> {
    const url = `${this.backendApiUrl}/files/pdf`;
    const user = localStorage.getItem('user');
    if (!user) {
      console.error('No user found in localStorage!');
      return;
    }

    const parsedUser = JSON.parse(user);
    const authToken = parsedUser.authToken;

    if (!authToken) {
      console.error('No authToken found in localStorage!');
      return;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    });

    const fileId = signedUrlResponse?.[0]?.id || '';

    if (!fileId) {
      console.error('Missing file ID from signed URL response');
      return;
    }

    const body = {
      fileSize,
      folderId,
      host: 'https://www.weavatools.com/apis',
      id: fileId,
      originalFileName: fileName
    };

    try {
      const response = await this.http.post(url, body, { headers }).toPromise();
      console.log('PDF metadata saved successfully:', response);
    } catch (error) {
      console.error('Error saving PDF metadata:', error);
    }
  }
}
