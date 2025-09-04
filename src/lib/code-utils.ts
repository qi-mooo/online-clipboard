/**
 * 代码生成和验证工具函数
 * 用于生成随机代码、验证代码格式和检查代码唯一性
 */

import { optimizedClipboardService } from './optimized-clipboard-service';

// 字符集：排除容易混淆的字符 (0, O, l, I)
const CODE_CHARSET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789';

/**
 * 生成随机代码
 * @param length 代码长度，默认为6-8位随机长度
 * @returns 生成的随机代码
 */
export function generateRandomCode(length?: number): string {
  // 如果没有指定长度，随机选择6-8位
  const codeLength = length || Math.floor(Math.random() * 3) + 6; // 6, 7, 或 8
  
  let result = '';
  for (let i = 0; i < codeLength; i++) {
    const randomIndex = Math.floor(Math.random() * CODE_CHARSET.length);
    result += CODE_CHARSET[randomIndex];
  }
  
  return result;
}

/**
 * 验证代码格式
 * 支持中文、英文、数字和常见符号，长度1-50个字符
 * @param code 要验证的代码
 * @returns 验证结果对象
 */
export function validateCodeFormat(code: string): { isValid: boolean; error?: string } {
  if (!code) {
    return { isValid: false, error: '代码不能为空' };
  }
  
  if (code.length < 1 || code.length > 50) {
    return { isValid: false, error: '代码长度必须在1-50个字符之间' };
  }
  
  // 允许中文、英文、数字和常见符号
  const validCodeRegex = /^[\u4e00-\u9fa5a-zA-Z0-9\-_\.]+$/;
  if (!validCodeRegex.test(code)) {
    return { isValid: false, error: '代码只能包含中文、英文、数字、连字符、下划线和点号' };
  }
  
  return { isValid: true };
}

/**
 * 检查代码是否已存在于数据库中（使用缓存优化）
 * @param code 要检查的代码
 * @returns Promise<boolean> 如果代码已存在返回true，否则返回false
 */
export async function isCodeExists(code: string): Promise<boolean> {
  try {
    return await optimizedClipboardService.codeExists(code);
  } catch (error) {
    console.error('检查代码唯一性时出错:', error);
    // 在出错的情况下，为了安全起见，假设代码已存在
    return true;
  }
}

/**
 * 生成唯一的随机代码
 * 会检查数据库确保生成的代码是唯一的
 * @param maxRetries 最大重试次数，默认10次
 * @returns Promise<string> 唯一的随机代码
 */
export async function generateUniqueCode(maxRetries: number = 10): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateRandomCode();
    const exists = await isCodeExists(code);
    
    if (!exists) {
      return code;
    }
  }
  
  // 如果重试多次仍然冲突，使用时间戳确保唯一性
  const timestamp = Date.now().toString(36);
  const randomSuffix = generateRandomCode(4);
  return `${randomSuffix}${timestamp}`;
}

/**
 * 验证并清理代码
 * 对输入的代码进行格式验证和基本清理
 * @param code 原始代码
 * @returns 清理后的代码和验证结果
 */
export function sanitizeCode(code: string): { cleanCode: string; isValid: boolean; error?: string } {
  if (!code) {
    return { cleanCode: '', isValid: false, error: '代码不能为空' };
  }
  
  // 去除首尾空格
  const cleanCode = code.trim();
  
  // 验证清理后的代码
  const validation = validateCodeFormat(cleanCode);
  
  return {
    cleanCode,
    isValid: validation.isValid,
    error: validation.error
  };
}