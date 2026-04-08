import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket | null = null;
  private channelListeners = new Map<string, Set<(data: any) => void>>();

  connect(token: string): void {
    if (this.socket?.connected) {
      console.warn('Socket already connected.');
      return;
    }

    this.socket = io(environment.socketUrl, {
      transports: ['websocket'],
      path: '/socket.io',
      auth: { token },
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      this.attachRegisteredListeners();
    });

    this.socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message || err);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('Socket disconnected:', reason);
    });

    this.socket.on('message', (msg) => {
      console.log('Server message:', msg);
    });

    this.attachRegisteredListeners();
  }

  emitLogin(userId: string) {
    if (this.socket?.connected) {
      this.socket.emit('login', { userId });
    } else {
      console.warn('Cannot emit login, socket not connected.');
    }
  }

  subscribeToChannel(channel: string, callback: (data: any) => void): void {
    if (!this.channelListeners.has(channel)) {
      this.channelListeners.set(channel, new Set());
    }

    this.channelListeners.get(channel)!.add(callback);

    if (this.socket) {
      this.socket.off(channel, callback);
      this.socket.on(channel, callback);
    }

    console.log('Socket listened:', channel);
  }

  emitEvent(event: string, data: any): void {
    const listeners = this.channelListeners.get(event);
    listeners?.forEach((listener) => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in local listener for ${event}:`, error);
      }
    });

    if (this.socket?.connected) {
      this.socket.emit(event, data);
      console.log('Socket emitted:', event, data);
    } else {
      console.warn(`Cannot emit ${event}, socket not connected.`);
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  private attachRegisteredListeners(): void {
    if (!this.socket) return;

    this.channelListeners.forEach((callbacks, channel) => {
      callbacks.forEach((callback) => {
        this.socket!.off(channel, callback);
        this.socket!.on(channel, callback);
      });
    });
  }
}
