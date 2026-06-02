import { useEffect, useState } from 'react'

import { createProduct } from '../../api'

import './AddProduct.css'



export default function AddProduct({ shopId, onProductAdded, onClose }) {

  const [formData, setFormData] = useState({

    title: '',

    description: '',

    price_or_range: '',

  })

  const [images, setImages] = useState([])

  const [previews, setPreviews] = useState([])

  const [submitting, setSubmitting] = useState(false)

  const [uploadProgress, setUploadProgress] = useState(null)

  const [error, setError] = useState('')



  useEffect(() => {

    return () => {

      previews.forEach((url) => {

        if (url.startsWith('blob:')) URL.revokeObjectURL(url)

      })

    }

  }, [previews])



  const handleChange = (e) => {

    setFormData({ ...formData, [e.target.name]: e.target.value })

  }



  const handleImages = (e) => {

    previews.forEach((url) => {

      if (url.startsWith('blob:')) URL.revokeObjectURL(url)

    })

    const files = Array.from(e.target.files || [])

    setImages(files)

    setPreviews(files.map((f) => URL.createObjectURL(f)))

  }



  const handleSubmit = async (e) => {

    e.preventDefault()

    setSubmitting(true)

    setError('')

    setUploadProgress('Uploading…')



    try {

      const payload = new FormData()

      payload.append('title', formData.title)

      payload.append('description', formData.description)

      payload.append('price_or_range', formData.price_or_range)

      images.forEach((file) => payload.append('images', file))



      const product = await createProduct(shopId, payload)

      onProductAdded(product)

      onClose()

    } catch (err) {

      setError(err.response?.data?.error || 'Failed to add product')

    } finally {

      setSubmitting(false)

      setUploadProgress(null)

    }

  }



  return (

    <div className="add-product-overlay" onClick={onClose}>

      <div className="add-product-modal" onClick={(e) => e.stopPropagation()}>

        <button type="button" className="add-product-close" onClick={onClose}>✕</button>

        <h3>Add Product / Service</h3>



        {error && <p className="add-product-error" role="alert">{error}</p>}

        {uploadProgress && <p className="add-product-progress">{uploadProgress}</p>}



        <form className="add-product-form" onSubmit={handleSubmit}>

          <div className="add-product-form-body">

            <input

              name="title"

              className="add-product-input"

              placeholder="Title"

              value={formData.title}

              onChange={handleChange}

              required

            />

            <textarea

              name="description"

              className="add-product-textarea"

              placeholder="Description"

              value={formData.description}

              onChange={handleChange}

              rows={3}

            />

            <input

              name="price_or_range"

              className="add-product-input"

              placeholder="Price or range"

              value={formData.price_or_range}

              onChange={handleChange}

            />

            <label className="add-product-file-label">

              Product images (multiple)

              <input type="file" accept="image/*" multiple onChange={handleImages} />

            </label>

            {previews.length > 0 && (

              <div className="add-product-previews" aria-label="Image previews">

                {previews.map((src, i) => (

                  <img key={src} src={src} alt={`Preview ${i + 1}`} />

                ))}

              </div>

            )}

          </div>

          <button type="submit" className="add-product-submit" disabled={submitting}>

            {submitting ? 'Adding…' : 'Add Product'}

          </button>

        </form>

      </div>

    </div>

  )

}


