# Markdown Reader · 示例文档

> 这是一份**示例 Markdown**，用来测试渲染效果。
> Notion 风格、五语言支持、浅深主题。

## 文本格式

- **加粗** 和 *斜体* 和 ~~删除线~~
- `行内代码`、行内链接 [Anthropic 官网](https://www.anthropic.com)
- 列表项有圆点

## 代码高亮

```python
def fibonacci(n):
    """Compute the nth Fibonacci number."""
    if n < 2:
        return n
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

print(fibonacci(10))  # 55
```

```javascript
const greet = (name) => `Hello, ${name}!`;
console.log(greet("世界"));
```

## 表格

| 功能 | 状态 | 备注 |
|------|------|------|
| 阅读模式 | ✅ | 默认开启 |
| 编辑模式 | ✅ | Ctrl+E 切换 |
| 五语言 UI | ✅ | 简中 / 繁中 / 英 / 日 / 韩 |
| Mermaid 流程图 | 🔌 | 可选插件 |
| LaTeX 公式 | 🔌 | 可选插件 |

## 引用与待办

> "审美高于记事本，体验直追 Notion。"

任务列表：
- [x] 完成核心渲染
- [x] 完成模式切换
- [ ] 完成全部验收清单

## 多级标题

### 三级标题

文本 `code`。

#### 四级标题

更深层。

---

## 结尾

按 `Ctrl+E` 切换到编辑模式试试改这段文字。已经修改






水水水水
