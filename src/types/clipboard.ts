export interface ClipboardData {
  id: string
  code: string
  content: string
  createdAt: Date
  updatedAt: Date
  lastAccessed: Date
}

export interface CreateClipboardRequest {
  content: string
}

export interface UpdateClipboardRequest {
  content: string
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  code?: string
  details?: any
  timestamp?: string
  requestId?: string
}

export interface GenerateCodeResponse {
  code: string
}