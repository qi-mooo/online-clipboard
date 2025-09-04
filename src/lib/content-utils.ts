/**
 * 内容验证和处理工具函数
 * 用于验证输入内容、处理特殊字符和URL编码/解码
 */

/**
 * 内容验证结果接口
 */
export interface ContentValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * 内容处理结果接口
 */
export interface ContentProcessResult {
  processedContent: string;
  originalLength: number;
  processedLength: number;
  hasChanges: boolean;
}

// 最大内容长度 (1MB)
const MAX_CONTENT_LENGTH = 1024 * 1024;

// 危险的HTML标签和属性模式
const DANGEROUS_HTML_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^>]*>/gi,
  /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi, // 事件处理器
  /javascript:/gi,
  /vbscript:/gi,
  /data:text\/html/gi
];

/**
 * 验证内容长度和格式
 * @param content 要验证的内容
 * @returns 验证结果
 */
export function validateContentLength(content: string): ContentValidationResult {
  if (content.length === 0) {
    return { isValid: true }; // 空内容是允许的
  }
  
  if (content.length > MAX_CONTENT_LENGTH) {
    return {
      isValid: false,
      error: `内容长度超过限制，最大允许 ${Math.floor(MAX_CONTENT_LENGTH / 1024)}KB`
    };
  }
  
  return { isValid: true };
}

/**
 * 验证内容格式和安全性
 * @param content 要验证的内容
 * @returns 验证结果
 */
export function validateContentFormat(content: string): ContentValidationResult {
  const warnings: string[] = [];
  
  // 检查是否包含危险的HTML内容
  for (const pattern of DANGEROUS_HTML_PATTERNS) {
    if (pattern.test(content)) {
      warnings.push('内容包含可能不安全的HTML标签或脚本');
      break;
    }
  }
  
  // 检查是否包含过多的连续空白字符
  const excessiveWhitespace = /\s{100,}/g;
  if (excessiveWhitespace.test(content)) {
    warnings.push('内容包含过多连续空白字符');
  }
  
  // 检查是否包含异常的控制字符
  const controlChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
  if (controlChars.test(content)) {
    warnings.push('内容包含控制字符');
  }
  
  return {
    isValid: true,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * 综合验证内容
 * @param content 要验证的内容
 * @returns 验证结果
 */
export function validateContent(content: string): ContentValidationResult {
  // 首先验证长度
  const lengthValidation = validateContentLength(content);
  if (!lengthValidation.isValid) {
    return lengthValidation;
  }
  
  // 然后验证格式和安全性
  const formatValidation = validateContentFormat(content);
  
  return {
    isValid: lengthValidation.isValid && formatValidation.isValid,
    error: lengthValidation.error || formatValidation.error,
    warnings: formatValidation.warnings
  };
}

/**
 * 清理和标准化内容
 * @param content 原始内容
 * @returns 处理结果
 */
export function sanitizeContent(content: string): ContentProcessResult {
  const originalLength = content.length;
  let processedContent = content;
  
  // 移除危险的HTML标签和脚本
  for (const pattern of DANGEROUS_HTML_PATTERNS) {
    processedContent = processedContent.replace(pattern, '');
  }
  
  // 清理HTML标签中的多余空格
  processedContent = processedContent.replace(/<(\w+)\s+>/g, '<$1>');
  
  // 移除控制字符（保留换行符、制表符和回车符）
  processedContent = processedContent.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // 标准化换行符为 \n
  processedContent = processedContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // 限制连续空行不超过3行
  processedContent = processedContent.replace(/\n{4,}/g, '\n\n\n');
  
  // 限制连续空格不超过10个
  processedContent = processedContent.replace(/ {11,}/g, '          ');
  
  const processedLength = processedContent.length;
  const hasChanges = originalLength !== processedLength || content !== processedContent;
  
  return {
    processedContent,
    originalLength,
    processedLength,
    hasChanges
  };
}

/**
 * URL编码内容（用于在URL中传输）
 * @param content 要编码的内容
 * @returns 编码后的内容
 */
export function encodeContentForUrl(content: string): string {
  try {
    return encodeURIComponent(content);
  } catch (error) {
    console.error('URL编码失败:', error);
    return '';
  }
}

/**
 * URL解码内容
 * @param encodedContent 编码的内容
 * @returns 解码后的内容
 */
export function decodeContentFromUrl(encodedContent: string): string {
  try {
    return decodeURIComponent(encodedContent);
  } catch (error) {
    console.error('URL解码失败:', error);
    return encodedContent; // 返回原始内容而不是空字符串
  }
}

/**
 * Base64编码内容
 * @param content 要编码的内容
 * @returns 编码后的内容
 */
export function encodeContentToBase64(content: string): string {
  try {
    // 在浏览器环境中使用btoa，在Node.js环境中使用Buffer
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      return btoa(unescape(encodeURIComponent(content)));
    } else {
      return Buffer.from(content, 'utf8').toString('base64');
    }
  } catch (error) {
    console.error('Base64编码失败:', error);
    return '';
  }
}

/**
 * Base64解码内容
 * @param encodedContent Base64编码的内容
 * @returns 解码后的内容
 */
export function decodeContentFromBase64(encodedContent: string): string {
  try {
    // 在浏览器环境中使用atob，在Node.js环境中使用Buffer
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      return decodeURIComponent(escape(atob(encodedContent)));
    } else {
      return Buffer.from(encodedContent, 'base64').toString('utf8');
    }
  } catch (error) {
    console.error('Base64解码失败:', error);
    return encodedContent; // 返回原始内容而不是空字符串
  }
}

/**
 * 检查内容是否为空或只包含空白字符
 * @param content 要检查的内容
 * @returns 是否为空内容
 */
export function isEmptyContent(content: string): boolean {
  return !content || content.trim().length === 0;
}

/**
 * 获取内容的基本统计信息
 * @param content 内容
 * @returns 统计信息
 */
export function getContentStats(content: string): {
  length: number;
  lines: number;
  words: number;
  characters: number;
  charactersNoSpaces: number;
} {
  const length = content.length;
  const lines = content.split('\n').length;
  
  // 计算单词数（支持中英文）
  const words = content
    .replace(/[\u4e00-\u9fa5]/g, ' $& ') // 中文字符前后加空格
    .split(/\s+/)
    .filter(word => word.trim().length > 0).length;
  
  const characters = content.length;
  const charactersNoSpaces = content.replace(/\s/g, '').length;
  
  return {
    length,
    lines,
    words,
    characters,
    charactersNoSpaces
  };
}

/**
 * 截取内容预览
 * @param content 原始内容
 * @param maxLength 最大长度，默认100
 * @returns 预览内容
 */
export function getContentPreview(content: string, maxLength: number = 100): string {
  if (content.length <= maxLength) {
    return content;
  }
  
  // 尝试在单词边界截取
  const truncated = content.substring(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  const lastNewlineIndex = truncated.lastIndexOf('\n');
  
  // 选择最近的边界
  const cutIndex = Math.max(lastSpaceIndex, lastNewlineIndex);
  
  if (cutIndex > maxLength * 0.8) {
    return truncated.substring(0, cutIndex) + '...';
  }
  
  return truncated + '...';
}