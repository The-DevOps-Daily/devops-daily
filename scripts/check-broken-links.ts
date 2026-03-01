#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import * as cheerio from 'cheerio'

/**
 * Recursively get all HTML files from a directory
 */
function getHtmlFiles(dir: string): string[] {
  const files: string[] = []
  const items = readdirSync(dir)

  for (const item of items) {
    const fullPath = join(dir, item)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      files.push(...getHtmlFiles(fullPath))
    } else if (item.endsWith('.html')) {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * Extract all internal links from an HTML file
 */
function extractInternalLinks(htmlPath: string): string[] {
  const html = readFileSync(htmlPath, 'utf-8')
  const $ = cheerio.load(html)
  const links: string[] = []

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href')
    if (href && href.startsWith('/') && !href.startsWith('//')) {
      // Remove hash fragments and query params
      const url = href.split('#')[0].split('?')[0]
      if (url.length > 0) {
        links.push(url)
      }
    }
  })

  return links
}

/**
 * Check if a URL path exists in the static build output
 */
function urlExists(url: string, outDir: string): boolean {
  // Remove leading slash
  const path = url.startsWith('/') ? url.slice(1) : url

  // Try multiple possible file locations
  const possiblePaths = [
    join(outDir, path), // Direct path
    join(outDir, path, 'index.html'), // Directory with index.html
    join(outDir, `${path}.html`), // .html extension
  ]

  for (const filePath of possiblePaths) {
    try {
      const stat = statSync(filePath)
      if (stat.isFile() || stat.isDirectory()) {
        return true
      }
    } catch {
      // File doesn't exist, continue
    }
  }

  return false
}

/**
 * Main function to check for broken links
 */
function main() {
  const outDir = join(process.cwd(), 'out')
  console.log('\n🔍 Checking for broken internal links...\n')

  const htmlFiles = getHtmlFiles(outDir)
  console.log(`📄 Found ${htmlFiles.length} HTML files to scan\n`)

  const brokenLinks = new Map<string, string[]>()

  for (const htmlFile of htmlFiles) {
    const links = extractInternalLinks(htmlFile)
    const uniqueLinks = [...new Set(links)]

    for (const link of uniqueLinks) {
      if (!urlExists(link, outDir)) {
        const relativePath = htmlFile.replace(outDir + '/', '')
        if (!brokenLinks.has(link)) {
          brokenLinks.set(link, [])
        }
        brokenLinks.get(link)!.push(relativePath)
      }
    }
  }

  if (brokenLinks.size === 0) {
    console.log('✅ No broken internal links found!\n')
    process.exit(0)
  }

  console.error(`❌ Found ${brokenLinks.size} broken internal link(s):\n`)

  for (const [link, sources] of brokenLinks.entries()) {
    console.error(`  ${link}`)
    console.error(`    Found in ${sources.length} file(s):${
      sources.length <= 3
        ? ''
        : ` (showing first 3 of ${sources.length})`
    }`)
    for (const source of sources.slice(0, 3)) {
      console.error(`    - ${source}`)
    }
    console.error('')
  }

  process.exit(1)
}

main()
