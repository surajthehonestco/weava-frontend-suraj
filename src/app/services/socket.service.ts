import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket | null = null;

  // Connect socket after login with auth token
  connect(token: string): void {
    if (this.socket?.connected) {
      console.warn('⚠️ Socket already connected.');
      return;
    }

    this.socket = io(environment.socketUrl, {
      transports: ['websocket'],
      path: '/socket.io',
      auth: { token },
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
    });

    this.socket.on('connect_error', (err) => {
      console.error('❌ Socket connection error:', err.message || err);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('🔌 Socket disconnected:', reason);
    });

    this.socket.on('message', (msg) => {
      console.log('📨 Server message:', msg);
    });
  }

  // Emit a login-specific event (optional)
  emitLogin(userId: string) {
    if (this.socket?.connected) {
      this.socket.emit('login', { userId });
    } else {
      console.warn('⚠️ Cannot emit login, socket not connected.');
    }
  }

  // Subscribe to a specific event/channel
  subscribeToChannel(channel: string, callback: (data: any) => void): void {
    if (!this.socket) {
      console.warn(`⚠️ Cannot subscribe to ${channel}, socket not initialized.`);
      return;
    }
    this.socket.on(channel, callback);
    console.log("📤 Socket listened:", channel, callback);
  }

  // Emit any event
  emitEvent(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
      console.log("📤 Socket emitted:", event, data);
    } else {
      console.warn(`⚠️ Cannot emit ${event}, socket not connected.`);
    }
  }

  // Disconnect socket
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Optional: Get raw socket instance
  getSocket(): Socket | null {
    return this.socket;
  }
}
