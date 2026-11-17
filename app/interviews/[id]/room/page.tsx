import { RoomScreen } from '@/components/ChatRoom'

export const metadata = { title: 'Room' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RoomScreen id={id} />
}
