import { PhotoEditor } from "@/components/photo-editor"

export default function Home() {
  return (
    <main className="min-h-screen p-4 md:p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-center mb-4">Photo ID Template Tool</h1>
        <p className="text-center mb-8 text-gray-600 max-w-2xl mx-auto">
          Upload your portrait photo, position your face within the guidelines, and download a high-resolution ID photo.
        </p>
        <PhotoEditor />
      </div>
    </main>
  )
}

