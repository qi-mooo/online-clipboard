#!/usr/bin/env node

// 测试环境变量配置脚本
console.log('🔍 检查环境变量配置...\n');

const requiredEnvs = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_DOMAIN',
  'NEXT_PUBLIC_AUTO_SAVE_DELAY',
  'NEXT_PUBLIC_AUTO_SAVE_ENABLED'
];

const optionalEnvs = [
  'DATABASE_URL',
  'NODE_ENV',
  'PORT',
  'HOSTNAME',
  'MAX_CONTENT_SIZE',
  'CLEANUP_INTERVAL_DAYS',
  'NEXTAUTH_SECRET',
  'LOG_LEVEL',
  'MAX_CLIPBOARDS',
  'CACHE_TTL',
  'NEXT_PUBLIC_MAX_CONTENT_LENGTH',
  'NEXT_PUBLIC_EDITOR_THEME'
];

console.log('📋 必需的环境变量:');
requiredEnvs.forEach(env => {
  const value = process.env[env];
  const status = value ? '✅' : '❌';
  console.log(`${status} ${env}: ${value || '未设置'}`);
});

console.log('\n📋 可选的环境变量:');
optionalEnvs.forEach(env => {
  const value = process.env[env];
  const status = value ? '✅' : '⚪';
  console.log(`${status} ${env}: ${value || '使用默认值'}`);
});

console.log('\n🔧 配置验证:');

// 验证自动保存延迟
const autoSaveDelay = parseInt(process.env.NEXT_PUBLIC_AUTO_SAVE_DELAY || '1000', 10);
if (isNaN(autoSaveDelay) || autoSaveDelay < 100) {
  console.log('⚠️  NEXT_PUBLIC_AUTO_SAVE_DELAY 应该是一个大于等于 100 的数字');
} else {
  console.log(`✅ 自动保存延迟: ${autoSaveDelay}ms`);
}

// 验证自动保存启用状态
const autoSaveEnabled = process.env.NEXT_PUBLIC_AUTO_SAVE_ENABLED !== 'false';
console.log(`✅ 自动保存状态: ${autoSaveEnabled ? '启用' : '禁用'}`);

// 验证域名配置
const domain = process.env.NEXT_PUBLIC_DOMAIN;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;
if (domain && appUrl) {
  if (appUrl.includes(domain)) {
    console.log('✅ 域名配置一致');
  } else {
    console.log('⚠️  NEXT_PUBLIC_APP_URL 和 NEXT_PUBLIC_DOMAIN 不匹配');
  }
}

// 验证端口配置
const port = parseInt(process.env.PORT || '3000', 10);
if (isNaN(port) || port < 1 || port > 65535) {
  console.log('⚠️  PORT 应该是一个有效的端口号 (1-65535)');
} else {
  console.log(`✅ 端口配置: ${port}`);
}

console.log('\n🚀 配置检查完成!');