import { evaluate } from "@mdx-js/mdx"
import * as runtime from "react/jsx-runtime"
import * as reactDom from "react-dom/server"
import remarkGfm from "remark-gfm"
import rehypeSlug from "rehype-slug"
import React from "react"
import { mdxComponents } from "@/components/mdx"

export async function compileMDXToHTML(source: string): Promise<string> {
  const { default: MDXContent } = await evaluate(source, {
    ...runtime,
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeSlug],
    Fragment: React.Fragment,
    useMDXComponents: () => mdxComponents,
  })

  return reactDom.renderToString(React.createElement(MDXContent))
}
