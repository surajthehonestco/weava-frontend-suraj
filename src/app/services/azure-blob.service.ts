import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class AzureBlobService {
  private accountName = "weavadev";  // ✅ Your Azure Storage Account
  private containerName = "pdfs";    // ✅ Your Azure Blob Container
  private sasToken = "sv=2025-01-05&spr=https&se=2025-04-13T21%3A32%3A06Z&sr=b&sp=cw&sig=WFpwmwfMPuRdXW4QDXoIs%2FWJDuzWr9CVv6uiy9DTigQ%3D"; // ✅ Your Azure SAS Token
  private backendApiUrl = "https://weavadev1.azurewebsites.net"; // ✅ Backend API Base URL

  constructor(private http: HttpClient) {}

  // ✅ Upload File to Azure Blob Storage
  async uploadFile(file: File, folderId: string): Promise<boolean> {
    try {
      const sasToken = await this.getSasToken(file.name);
      if (!sasToken) return false;
  
      const blobUrl = `https://${this.accountName}.blob.core.windows.net/${this.containerName}/${file.name}?${sasToken}`;
  
      const response = await fetch(blobUrl, {
        method: "PUT",
        body: file,
        headers: {
          "x-ms-blob-type": "BlockBlob",
          "Content-Type": file.type
        }
      });
  
      if (response.ok) {
        console.log("✅ File uploaded successfully:", file.name);
  
        const signedUrlResponse = await this.getSignedUrl(file.name, folderId);
        if (signedUrlResponse) {
          await this.setPdf(signedUrlResponse, file.name, folderId);
        }
  
        return true;
      } else {
        console.error("❌ Upload failed:", response.statusText);
        return false;
      }
    } catch (error) {
      console.error("🚨 Error uploading file:", error);
      return false;
    }
  }

  private async getSasToken(fileName: string): Promise<string | null> {
    const user = localStorage.getItem('user');
    if (!user) {
      console.error("❌ No user found in localStorage!");
      return null;
    }
  
    const parsedUser = JSON.parse(user);
    const authToken = parsedUser.authToken;
  
    if (!authToken) {
      console.error("❌ No authToken found in localStorage!");
      return null;
    }
  
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${authToken}`
    });
  
    try {
      const response: any = await this.http.get(`${this.backendApiUrl}/files/sas-token?fileName=${fileName}`, { headers }).toPromise();
      return response?.token || null;
    } catch (error) {
      console.error("❌ Error fetching SAS token:", error);
      return null;
    }
  }  

  // ✅ Call API to Get Signed URL After Upload
  async getSignedUrl(fileName: string, folderId: string): Promise<any> {
    const url = `${this.backendApiUrl}/files/getSignedUrl`;
    
    // ✅ Retrieve the authentication token from localStorage
    const user = localStorage.getItem('user');
    if (!user) {
      console.error("❌ No user found in localStorage!");
      return null;
    }
    
    const parsedUser = JSON.parse(user);
    const authToken = parsedUser.authToken; // ✅ Ensure we get the auth token

    if (!authToken) {
      console.error("❌ No authToken found in localStorage!");
      return null;
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${authToken}`, // ✅ Add the Bearer Token
      'Content-Type': 'application/json'
    });

    const body = {
      fileNameList: [fileName],
      folderId: folderId
    };

    try {
      const response = await this.http.post(url, body, { headers }).toPromise();
      console.log("✅ Signed URL response:", response);
      return response; // Return response data for setPdf
    } catch (error) {
      console.error("❌ Error getting signed URL:", error);
      return null;
    }
  }

  // ✅ Set PDF API Call after getting Signed URL
  async setPdf(signedUrlResponse: any, fileName: string, folderId: string): Promise<void> {
    const url = `${this.backendApiUrl}/files/pdf`;

    // ✅ Retrieve the authentication token from localStorage
    const user = localStorage.getItem('user');
    if (!user) {
      console.error("❌ No user found in localStorage!");
      return;
    }
    
    const parsedUser = JSON.parse(user);
    const authToken = parsedUser.authToken; // ✅ Ensure we get the auth token

    if (!authToken) {
      console.error("❌ No authToken found in localStorage!");
      return;
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${authToken}`, // ✅ Add the Bearer Token
      'Content-Type': 'application/json'
    });

    // ✅ Extract necessary fields from `signedUrlResponse`
    const fileData = signedUrlResponse?.metadata?.requestPayload?.fileNameList[0] || {};
    const fileId = signedUrlResponse[0].id || "";

    if (!fileId) {
      console.error("❌ Missing file ID from signed URL response");
      return;
    }

    const body = {
      "fileSize": fileData.size || 146185,
      "folderId": folderId,
      "host": "https://www.weavatools.com/apis",
      "id": fileId,
      "originalFileName": fileName
    };

    try {
      const response = await this.http.post(url, body, { headers }).toPromise();
      console.log("✅ PDF metadata saved successfully:", response);
    } catch (error) {
      console.error("❌ Error saving PDF metadata:", error);
    }
  }
}
