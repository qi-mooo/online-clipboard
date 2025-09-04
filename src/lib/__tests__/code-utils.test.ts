import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  generateRandomCode, 
  validateCodeFormat, 
  isCodeExists, 
  generateUniqueCode, 
  sanitizeCode 
} from '../code-utils'

// Mock the database
vi.mock('../db', () => ({
  db: {
    clipboard: {
      findUnique: vi.fn()
    }
  }
}))

import { db } from '../db'

describe('code-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateRandomCode', () => {
    it('应该生成指定长度的随机代码', () => {
      const code = generateRandomCode(8)
      expect(code).toHaveLength(8)
    })

    it('应该生成6-8位长度的随机代码（当未指定长度时）', () => {
      const code = generateRandomCode()
      expect(code.length).toBeGreaterThanOrEqual(6)
      expect(code.length).toBeLessThanOrEqual(8)
    })

    it('应该只包含允许的字符集', () => {
      const code = generateRandomCode(20)
      const allowedChars = /^[abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789]+$/
      expect(code).toMatch(allowedChars)
    })

    it('应该不包含容易混淆的字符', () => {
      const code = generateRandomCode(100) // 生成较长代码增加测试覆盖率
      expect(code).not.toMatch(/[0OlI]/)
    })

    it('每次生成的代码应该不同', () => {
      const codes = new Set()
      for (let i = 0; i < 100; i++) {
        codes.add(generateRandomCode(8))
      }
      // 100个8位代码应该都不相同（概率极高）
      expect(codes.size).toBe(100)
    })
  })

  describe('validateCodeFormat', () => {
    it('应该接受有效的英文代码', () => {
      const result = validateCodeFormat('test123')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('应该接受有效的中文代码', () => {
      const result = validateCodeFormat('测试代码')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('应该接受包含连字符和下划线的代码', () => {
      const result = validateCodeFormat('test-code_123')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('应该接受包含点号的代码', () => {
      const result = validateCodeFormat('test.code')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('应该拒绝空代码', () => {
      const result = validateCodeFormat('')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('代码不能为空')
    })

    it('应该拒绝过长的代码', () => {
      const longCode = 'a'.repeat(51)
      const result = validateCodeFormat(longCode)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('代码长度必须在1-50个字符之间')
    })

    it('应该拒绝包含特殊字符的代码', () => {
      const result = validateCodeFormat('test@code')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('代码只能包含中文、英文、数字、连字符、下划线和点号')
    })

    it('应该拒绝包含空格的代码', () => {
      const result = validateCodeFormat('test code')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('代码只能包含中文、英文、数字、连字符、下划线和点号')
    })
  })

  describe('isCodeExists', () => {
    it('当代码存在时应该返回true', async () => {
      vi.mocked(db.clipboard.findUnique).mockResolvedValue({ id: '1' })
      
      const result = await isCodeExists('existing-code')
      expect(result).toBe(true)
      expect(db.clipboard.findUnique).toHaveBeenCalledWith({
        where: { code: 'existing-code' },
        select: { id: true }
      })
    })

    it('当代码不存在时应该返回false', async () => {
      vi.mocked(db.clipboard.findUnique).mockResolvedValue(null)
      
      const result = await isCodeExists('non-existing-code')
      expect(result).toBe(false)
    })

    it('当数据库查询出错时应该返回true（安全起见）', async () => {
      vi.mocked(db.clipboard.findUnique).mockRejectedValue(new Error('Database error'))
      
      const result = await isCodeExists('error-code')
      expect(result).toBe(true)
    })
  })

  describe('generateUniqueCode', () => {
    it('应该生成唯一代码', async () => {
      vi.mocked(db.clipboard.findUnique).mockResolvedValue(null)
      
      const code = await generateUniqueCode()
      expect(code).toBeDefined()
      expect(code.length).toBeGreaterThanOrEqual(6)
      expect(code.length).toBeLessThanOrEqual(8)
    })

    it('应该在代码冲突时重试', async () => {
      vi.mocked(db.clipboard.findUnique)
        .mockResolvedValueOnce({ id: '1' }) // 第一次冲突
        .mockResolvedValueOnce(null) // 第二次成功
      
      const code = await generateUniqueCode()
      expect(code).toBeDefined()
      expect(db.clipboard.findUnique).toHaveBeenCalledTimes(2)
    })

    it('应该在达到最大重试次数后使用时间戳确保唯一性', async () => {
      vi.mocked(db.clipboard.findUnique).mockResolvedValue({ id: '1' })
      
      const code = await generateUniqueCode(2)
      expect(code).toBeDefined()
      expect(code.length).toBeGreaterThan(8) // 包含时间戳的代码会更长
      expect(db.clipboard.findUnique).toHaveBeenCalledTimes(2)
    })
  })

  describe('sanitizeCode', () => {
    it('应该去除首尾空格', () => {
      const result = sanitizeCode('  test-code  ')
      expect(result.cleanCode).toBe('test-code')
      expect(result.isValid).toBe(true)
    })

    it('应该返回验证错误', () => {
      const result = sanitizeCode('  invalid@code  ')
      expect(result.cleanCode).toBe('invalid@code')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('代码只能包含中文、英文、数字、连字符、下划线和点号')
    })

    it('应该处理空字符串', () => {
      const result = sanitizeCode('')
      expect(result.cleanCode).toBe('')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('代码不能为空')
    })

    it('应该处理只包含空格的字符串', () => {
      const result = sanitizeCode('   ')
      expect(result.cleanCode).toBe('')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('代码不能为空')
    })

    it('应该处理有效的中文代码', () => {
      const result = sanitizeCode(' 测试代码 ')
      expect(result.cleanCode).toBe('测试代码')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })
  })
})