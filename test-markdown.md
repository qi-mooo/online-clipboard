# 测试 Markdown 功能

这是一个测试文档，用于验证新的 Markdown 功能。

## 基本语法

### 文本格式
- **粗体文本**
- *斜体文本*
- ~~删除线~~
- `行内代码`

### 列表
1. 有序列表项 1
2. 有序列表项 2
   - 嵌套无序列表
   - 另一个嵌套项

### 代码块
```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
  return `Welcome to the enhanced clipboard!`;
}

greet("用户");
```

```python
def calculate_stats(text):
    lines = text.split('\n')
    words = text.split()
    chars = len(text)
    
    return {
        'lines': len(lines),
        'words': len(words), 
        'characters': chars
    }
```

### 表格
| 功能 | 状态 | 描述 |
|------|------|------|
| 行号显示 | ✅ | 左侧显示行号，支持滚动同步 |
| Markdown 预览 | ✅ | 实时渲染 Markdown 内容 |
| 语法高亮 | ✅ | 代码块支持多种语言高亮 |
| 分屏模式 | ✅ | 同时显示编辑和预览 |

### 任务列表
- [x] 实现行号显示功能
- [x] 添加 Markdown 预览
- [x] 支持代码语法高亮
- [x] 实现分屏模式
- [ ] 添加更多 Markdown 扩展
- [ ] 优化移动端体验

### 引用
> 这是一个引用块。
> 
> 可以包含多行内容，支持 **格式化** 文本。

### 链接和图片
[GitHub](https://github.com)

### 分隔线
---

## 高级功能

### 数学公式（如果支持）
E = mc²

### 脚注（如果支持）
这是一个带脚注的文本[^1]。

[^1]: 这是脚注内容。

## 测试长文本

这是一段很长的文本，用于测试编辑器的性能和滚动同步功能。Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

### 多行代码测试
```bash
#!/bin/bash

# 部署脚本
echo "开始部署..."

# 构建项目
npm run build

# 启动服务
npm start

echo "部署完成！"
```

这个测试文档包含了各种 Markdown 元素，可以用来验证预览功能是否正常工作。