import {
  Button,
  DisclosureGroup,
  HStack,
  Image,
  List,
  NavigationStack,
  Section,
  Spacer,
  Text,
  VStack,
  useEffect,
  useState,
} from "scripting"

import { cloudreveListFolders } from "./core/cloudreve"
import { errorMessage } from "./core/tasks"
import type { CloudFolderNode } from "./core/types"

const ROOT = "cloudreve://my"
const DEEP_GREEN = "#2F6B50"
const MUTED = "#6E6E73"

type RowProps = {
  node: CloudFolderNode
  level: number
  expanded: Record<string, boolean>
  onToggle: (path: string, value: boolean) => void
  onSelect: (path: string) => void
}

function FolderRow({ node, level, expanded, onToggle, onSelect }: RowProps) {
  const isOpen = expanded[node.path] === true
  return (
    <VStack alignment="leading" spacing={2} padding={{ leading: level * 14 }}>
      <HStack spacing={8}>
        <DisclosureGroup
          label={
            <HStack spacing={6}>
              <Image systemName="folder" foregroundStyle={DEEP_GREEN} />
              <Text font={13} lineLimit={1}>
                {node.name}
              </Text>
            </HStack>
          }
          isExpanded={isOpen}
          onChanged={value => onToggle(node.path, value)}
        >
          <VStack alignment="leading" spacing={2}>
            {node.children.map(child => (
              <FolderRow
                key={child.path}
                node={child}
                level={level + 1}
                expanded={expanded}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            ))}
          </VStack>
        </DisclosureGroup>
        <Spacer />
        <Button title="选择" buttonStyle="glass" action={() => onSelect(node.path)} />
      </HStack>
    </VStack>
  )
}

function findNode(nodes: CloudFolderNode[], path: string): CloudFolderNode | null {
  for (const node of nodes) {
    if (node.path === path) return node
    const nested = findNode(node.children, path)
    if (nested) return nested
  }
  return null
}

function replaceChildren(
  nodes: CloudFolderNode[],
  path: string,
  children: CloudFolderNode[],
): CloudFolderNode[] {
  return nodes.map(node => {
    if (node.path === path) return { ...node, children }
    if (node.children.length === 0) return node
    return { ...node, children: replaceChildren(node.children, path, children) }
  })
}

type PickerProps = {
  isPresented: boolean
  onChanged: (presented: boolean) => void
  initialPath: string
  onSelect: (path: string) => void
}

export default function DirectoryPicker({
  isPresented,
  onChanged,
  initialPath,
  onSelect,
}: PickerProps) {
  const [roots, setRoots] = useState<CloudFolderNode[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [current, setCurrent] = useState(initialPath || ROOT)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isPresented) return
    setCurrent(initialPath || ROOT)
    setExpanded({})
    void loadFolder(ROOT, true)
  }, [isPresented, initialPath])

  const loadFolder = async (path: string, isRoot = false) => {
    setLoading(true)
    try {
      const folders = await cloudreveListFolders(path)
      const nodes: CloudFolderNode[] = folders.map(folder => ({ ...folder, children: [] }))
      if (isRoot) {
        setRoots(nodes)
      } else {
        setRoots(previous => replaceChildren(previous, path, nodes))
      }
      setError("")
    } catch (cause) {
      setError(`目录加载失败：${errorMessage(cause)}`)
    } finally {
      setLoading(false)
    }
  }

  const toggle = (path: string, value: boolean) => {
    setExpanded(previous => ({ ...previous, [path]: value }))
    if (value && !findNode(roots, path)?.children.length) void loadFolder(path)
  }

  const choose = (path: string) => {
    onSelect(path)
    onChanged(false)
  }

  return (
    <NavigationStack>
      <List
        navigationTitle="选择目录"
        navigationBarTitleDisplayMode="inline"
        toolbar={{ cancellationAction: <Button title="取消" action={() => onChanged(false)} /> }}
      >
        <Section title="当前目录">
          <Text font={13} foregroundStyle={DEEP_GREEN} lineLimit={1}>
            {current}
          </Text>
          <Button title="选择此目录" buttonStyle="glass" action={() => choose(current)} />
        </Section>

        <Section title="目录树">
          {loading && roots.length === 0 ? (
            <Text font={13} foregroundStyle={MUTED}>
              正在加载目录…
            </Text>
          ) : roots.length === 0 ? (
            <Text font={13} foregroundStyle={MUTED}>
              根目录下暂无子文件夹
            </Text>
          ) : (
            roots.map(node => (
              <FolderRow
                key={node.path}
                node={node}
                level={0}
                expanded={expanded}
                onToggle={toggle}
                onSelect={choose}
              />
            ))
          )}
        </Section>

        {error ? (
          <Section>
            <Text font={12} foregroundStyle="#C0392B">
              {error}
            </Text>
          </Section>
        ) : null}
      </List>
    </NavigationStack>
  )
}
