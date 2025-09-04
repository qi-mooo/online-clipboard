import { describe, it, expect, vi } from 'vitest'
import {
  validateContentLength,
  validateContentFormat,
  validateContent,
  sanitizeContent,
  encodeContentForUrl,
  decodeContentFromUrl,
  encodeContentToBase64,
  decodeContentFromBase64,
  isEmptyContent,
  getContentStats,
  getContentPreview
} from '../content-utils'

describe('content-utils', () => {
  describe('validateContentLength', () => {
    it('应该接受空内容', () => {
      const result = validateContentLength('')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('应该接受正常长度的内容', () => {
      const content = 'This is a normal content'
      const result = validateContentLength(content)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('应该拒绝超长内容', () => {
      const content = 'a'.repeat(1024 * 1024 + 1) // 超过1MB
      const result = validateContentLength(content)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('内容长度超过限制')
    })

    it('应该接受刚好达到限制的内容', () => {
      const content = 'a'.repeat(1024 * 1024) // 正好1MB
      const result = validateContentLength(content)
      expect(result.isValid).toBe(true)
    })
  })

  describe('validateContentFormat', () => {
    it('应该接受普通文本内容', () => {
      const content = 'This is a normal text content with 中文'
      const result = validateContentFormat(content)
      expect(result.isValid).toBe(true)
      expect(result.warnings).toBeUndefined()
    })

    it('应该警告包含script标签的内容', () => {
      const content = 'Hello <script>alert("xss")</script> world'
      const result = validateContentFormat(content)
      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('内容包含可能不安全的HTML标签或脚本')
    })

    it('应该警告包含iframe标签的内容', () => {
      const content = 'Hello <iframe src="evil.com"></iframe> world'
      const result = validateContentFormat(content)
      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('内容包含可能不安全的HTML标签或脚本')
    })

    it('应该警告包含事件处理器的内容', () => {
      const content = 'Hello <div onclick="alert()">click me</div>'
      const result = validateContentFormat(content)
      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('内容包含可能不安全的HTML标签或脚本')
    })

    it('应该警告包含javascript协议的内容', () => {
      const content = 'Hello <a href="javascript:alert()">link</a>'
      const result = validateContentFormat(content)
      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('内容包含可能不安全的HTML标签或脚本')
    })

    it('应该警告包含过多空白字符的内容', () => {
      const content = 'Hello' + ' '.repeat(150) + 'world'
      const result = validateContentFormat(content)
      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('内容包含过多连续空白字符')
    })

    it('应该警告包含控制字符的内容', () => {
      const content = 'Hello\x00\x01world'
      const result = validateContentFormat(content)
      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('内容包含控制字符')
    })

    it('应该接受包含正常换行符的内容', () => {
      const content = 'Line 1\nLine 2\nLine 3'
      const result = validateContentFormat(content)
      expect(result.isValid).toBe(true)
      expect(result.warnings).toBeUndefined()
    })
  })

  describe('validateContent', () => {
    it('应该综合验证内容', () => {
      const content = 'This is a valid content'
      const result = validateContent(content)
      expect(result.isValid).toBe(true)
    })

    it('应该返回长度错误', () => {
      const content = 'a'.repeat(1024 * 1024 + 1)
      const result = validateContent(content)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('内容长度超过限制')
    })

    it('应该返回格式警告', () => {
      const content = 'Hello <script>alert()</script>'
      const result = validateContent(content)
      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('内容包含可能不安全的HTML标签或脚本')
    })
  })

  describe('sanitizeContent', () => {
    it('应该移除危险的script标签', () => {
      const content = 'Hello <script>alert("xss")</script> world'
      const result = sanitizeContent(content)
      expect(result.processedContent).toBe('Hello  world')
      expect(result.hasChanges).toBe(true)
    })

    it('应该移除iframe标签', () => {
      const content = 'Hello <iframe src="evil.com"></iframe> world'
      const result = sanitizeContent(content)
      expect(result.processedContent).toBe('Hello  world')
      expect(result.hasChanges).toBe(true)
    })

    it('应该移除事件处理器', () => {
      const content = 'Hello <div onclick="alert()">content</div>'
      const result = sanitizeContent(content)
      expect(result.processedContent).toBe('Hello <div>content</div>')
      expect(result.hasChanges).toBe(true)
    })

    it('应该移除控制字符', () => {
      const content = 'Hello\x00\x01world'
      const result = sanitizeContent(content)
      expect(result.processedContent).toBe('Helloworld')
      expect(result.hasChanges).toBe(true)
    })

    it('应该标准化换行符', () => {
      const content = 'Line1\r\nLine2\rLine3\nLine4'
      const result = sanitizeContent(content)
      expect(result.processedContent).toBe('Line1\nLine2\nLine3\nLine4')
      expect(result.hasChanges).toBe(true)
    })

    it('应该限制连续空行', () => {
      const content = 'Line1\n\n\n\n\n\nLine2'
      const result = sanitizeContent(content)
      expect(result.processedContent).toBe('Line1\n\n\nLine2')
      expect(result.hasChanges).toBe(true)
    })

    it('应该限制连续空格', () => {
      const content = 'Hello' + ' '.repeat(20) + 'world'
      const result = sanitizeContent(content)
      expect(result.processedContent).toBe('Hello          world')
      expect(result.hasChanges).toBe(true)
    })

    it('应该保持正常内容不变', () => {
      const content = 'This is normal content\nwith multiple lines'
      const result = sanitizeContent(content)
      expect(result.processedContent).toBe(content)
      expect(result.hasChanges).toBe(false)
    })

    it('应该正确计算长度统计', () => {
      const content = 'Hello world'
      const result = sanitizeContent(content)
      expect(result.originalLength).toBe(11)
      expect(result.processedLength).toBe(11)
    })
  })

  describe('encodeContentForUrl', () => {
    it('应该正确编码普通文本', () => {
      const content = 'Hello World'
      const result = encodeContentForUrl(content)
      expect(result).toBe('Hello%20World')
    })

    it('应该正确编码中文内容', () => {
      const content = '你好世界'
      const result = encodeContentForUrl(content)
      expect(result).toBe('%E4%BD%A0%E5%A5%BD%E4%B8%96%E7%95%8C')
    })

    it('应该正确编码特殊字符', () => {
      const content = 'Hello & World!'
      const result = encodeContentForUrl(content)
      expect(result).toBe('Hello%20%26%20World!')
    })

    it('应该处理编码错误', () => {
      // Mock encodeURIComponent to throw error
      const originalEncode = global.encodeURIComponent
      global.encodeURIComponent = vi.fn().mockImplementation(() => {
        throw new Error('Encoding error')
      })

      const result = encodeContentForUrl('test')
      expect(result).toBe('')

      // Restore original function
      global.encodeURIComponent = originalEncode
    })
  })

  describe('decodeContentFromUrl', () => {
    it('应该正确解码普通文本', () => {
      const encoded = 'Hello%20World'
      const result = decodeContentFromUrl(encoded)
      expect(result).toBe('Hello World')
    })

    it('应该正确解码中文内容', () => {
      const encoded = '%E4%BD%A0%E5%A5%BD%E4%B8%96%E7%95%8C'
      const result = decodeContentFromUrl(encoded)
      expect(result).toBe('你好世界')
    })

    it('应该处理解码错误', () => {
      const invalidEncoded = '%ZZ%YY'
      const result = decodeContentFromUrl(invalidEncoded)
      expect(result).toBe(invalidEncoded) // 返回原始内容
    })
  })

  describe('encodeContentToBase64', () => {
    it('应该正确编码普通文本', () => {
      const content = 'Hello World'
      const result = encodeContentToBase64(content)
      expect(result).toBe('SGVsbG8gV29ybGQ=')
    })

    it('应该正确编码中文内容', () => {
      const content = '你好'
      const result = encodeContentToBase64(content)
      // 验证结果是有效的base64字符串
      expect(result).toMatch(/^[A-Za-z0-9+/]*={0,2}$/)
    })

    it('应该处理编码错误', () => {
      // 在Node.js环境中测试Buffer错误
      const originalBuffer = global.Buffer
      if (typeof window === 'undefined') {
        global.Buffer = {
          from: vi.fn().mockImplementation(() => {
            throw new Error('Buffer error')
          })
        } as any

        const result = encodeContentToBase64('test')
        expect(result).toBe('')

        global.Buffer = originalBuffer
      }
    })
  })

  describe('decodeContentFromBase64', () => {
    it('应该正确解码普通文本', () => {
      const encoded = 'SGVsbG8gV29ybGQ='
      const result = decodeContentFromBase64(encoded)
      expect(result).toBe('Hello World')
    })

    it('应该处理解码错误', () => {
      const invalidBase64 = 'invalid-base64!'
      const result = decodeContentFromBase64(invalidBase64)
      expect(result).toBe(invalidBase64) // 返回原始内容
    })
  })

  describe('isEmptyContent', () => {
    it('应该识别空字符串', () => {
      expect(isEmptyContent('')).toBe(true)
    })

    it('应该识别只包含空格的字符串', () => {
      expect(isEmptyContent('   ')).toBe(true)
    })

    it('应该识别只包含换行符的字符串', () => {
      expect(isEmptyContent('\n\n\n')).toBe(true)
    })

    it('应该识别包含内容的字符串', () => {
      expect(isEmptyContent('Hello')).toBe(false)
    })

    it('应该识别包含内容和空格的字符串', () => {
      expect(isEmptyContent('  Hello  ')).toBe(false)
    })
  })

  describe('getContentStats', () => {
    it('应该正确统计英文内容', () => {
      const content = 'Hello world\nThis is a test'
      const stats = getContentStats(content)
      expect(stats.length).toBe(26) // 实际长度是26
      expect(stats.lines).toBe(2)
      expect(stats.words).toBe(6)
      expect(stats.characters).toBe(26)
      expect(stats.charactersNoSpaces).toBe(21)
    })

    it('应该正确统计中文内容', () => {
      const content = '你好世界\n这是测试'
      const stats = getContentStats(content)
      expect(stats.length).toBe(9)
      expect(stats.lines).toBe(2)
      expect(stats.words).toBe(8) // 中文字符被当作单独的词
      expect(stats.characters).toBe(9)
      expect(stats.charactersNoSpaces).toBe(8)
    })

    it('应该正确统计混合内容', () => {
      const content = 'Hello 世界\nTest 测试'
      const stats = getContentStats(content)
      expect(stats.lines).toBe(2)
      expect(stats.words).toBe(6)
    })

    it('应该正确统计空内容', () => {
      const content = ''
      const stats = getContentStats(content)
      expect(stats.length).toBe(0)
      expect(stats.lines).toBe(1) // 空字符串split后仍有一个元素
      expect(stats.words).toBe(0)
      expect(stats.characters).toBe(0)
      expect(stats.charactersNoSpaces).toBe(0)
    })
  })

  describe('getContentPreview', () => {
    it('应该返回短内容的完整内容', () => {
      const content = 'Short content'
      const result = getContentPreview(content, 100)
      expect(result).toBe(content)
    })

    it('应该截取长内容并添加省略号', () => {
      const content = 'This is a very long content that should be truncated'
      const result = getContentPreview(content, 20)
      expect(result).toContain('...')
      expect(result.length).toBeLessThanOrEqual(23) // 20 + '...'
    })

    it('应该在单词边界截取', () => {
      const content = 'This is a very long content'
      const result = getContentPreview(content, 15)
      expect(result).toBe('This is a very...')
    })

    it('应该在换行符边界截取', () => {
      const content = 'Line 1\nLine 2 is very long'
      const result = getContentPreview(content, 15)
      expect(result).toBe('Line 1\nLine 2...')
    })

    it('应该使用默认长度', () => {
      const content = 'a'.repeat(150)
      const result = getContentPreview(content)
      expect(result.length).toBeLessThanOrEqual(103) // 100 + '...'
    })

    it('应该处理没有合适边界的情况', () => {
      const content = 'a'.repeat(50)
      const result = getContentPreview(content, 20)
      expect(result).toBe('a'.repeat(20) + '...')
    })
  })
})