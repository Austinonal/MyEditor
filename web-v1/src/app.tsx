import { useEffect, useState } from 'preact/hooks'
import { Home } from './screens/Home'
import { Ref } from './screens/Ref'
import { Analyze } from './screens/Analyze'
import { Review } from './screens/Review'
import { Editor } from './screens/Editor'

const useRoute = () => {
  const [h, setH] = useState(location.hash || '#/')
  useEffect(() => { const f = () => setH(location.hash || '#/'); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  return h.slice(2).split('/').filter(Boolean)
}

export function App() {
  const [r, id] = useRoute()
  if (r === 'ref') return <Ref />
  if (r === 'analyze' && id) return <Analyze id={id} key={id} />
  if (r === 'review' && id) return <Review id={id} key={id} />
  if (r === 'edit' && id) return <Editor id={id} key={id} />
  return <Home />
}
